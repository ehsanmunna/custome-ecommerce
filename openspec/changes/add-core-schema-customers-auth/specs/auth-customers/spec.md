## Purpose

Defines the shared customer identity data model every client database uses: customer accounts,
password hashes, delivery addresses, and hashed OTP records. It covers plan.md items 4 and 12 and is
the foundation for storefront login, account addresses, and checkout. Guest checkout stays an order
concern; this schema does not make a customer account mandatory for an order.

## ADDED Requirements

### Requirement: Customer accounts require at least one login identity

The system SHALL store customer accounts with an optional phone number and an optional email address,
and MUST reject an account that has neither. A phone number MUST be stored in E.164 format
(`+` followed by 8 to 15 digits). An email address MUST be stored in lowercase. An account MAY carry
both identities.

#### Scenario: Phone-only customer

- **WHEN** a customer is created with a valid E.164 phone and no email
- **THEN** the customer is stored with phone login available

#### Scenario: Email and phone customer

- **WHEN** a customer is created with a valid phone and a lowercase email
- **THEN** both identities are stored on the same account

#### Scenario: Customer without identity rejected

- **WHEN** a customer is created with neither a phone nor an email
- **THEN** the write is rejected

#### Scenario: Non-E.164 phone rejected

- **WHEN** a customer phone is stored without a leading plus sign or contains invalid characters
- **THEN** the write is rejected

#### Scenario: Mixed-case email rejected

- **WHEN** a customer email contains uppercase characters
- **THEN** the write is rejected

### Requirement: Customer login identities are unique

The system SHALL reject duplicate phone numbers and duplicate email addresses across customer
accounts. The unique rules MUST allow many accounts to omit phone or email, because those columns are
optional.

#### Scenario: Duplicate phone rejected

- **WHEN** a second customer is saved with a phone already used by another customer
- **THEN** the write is rejected

#### Scenario: Duplicate email rejected

- **WHEN** a second customer is saved with an email already used by another customer
- **THEN** the write is rejected

#### Scenario: Multiple accounts omit email

- **WHEN** two phone-only customers are stored without email addresses
- **THEN** both accounts are accepted

#### Scenario: Multiple accounts omit phone

- **WHEN** two email-only customers are stored without phone numbers
- **THEN** both accounts are accepted

### Requirement: Customer passwords are stored only as hashes

The system SHALL allow a customer password only when the account has an email. A password MUST be
stored as a non-reversible hash in the `password_hash` column, and the schema MUST NOT contain a
plaintext password column. A customer without a password hash MUST NOT be able to authenticate with a
password.

#### Scenario: Email customer with password hash

- **WHEN** a customer with an email is saved with a non-empty password hash
- **THEN** the hash is stored and the raw password is not

#### Scenario: Password without email rejected

- **WHEN** a customer without an email is saved with a password hash
- **THEN** the write is rejected

#### Scenario: Empty password hash rejected

- **WHEN** a customer is saved with an empty password hash
- **THEN** the write is rejected

#### Scenario: Phone-only customer without password

- **WHEN** a customer is created with a phone and no password hash
- **THEN** the account is accepted with OTP login only

### Requirement: Customer accounts have a lifecycle status

The system SHALL give each customer a status of `active` or `blocked`. A new account MUST default to
`active`, and an unsupported status MUST be rejected.

#### Scenario: New customer is active

- **WHEN** a customer is created without an explicit status
- **THEN** the stored status is `active`

#### Scenario: Customer can be blocked

- **WHEN** an existing customer is saved with the `blocked` status
- **THEN** the status is stored

#### Scenario: Unsupported customer status rejected

- **WHEN** a customer is saved with a status outside `active` and `blocked`
- **THEN** the write is rejected

### Requirement: Addresses belong to a registered customer

The system SHALL store delivery addresses only for existing customer accounts. Every address MUST
reference a customer and MUST include a recipient name, an E.164 recipient phone, address line 1, a
district, a division, and a two-letter uppercase country code that defaults to `BD`. Address line 2,
area, and postal code MAY be omitted. Deleting a customer SHALL delete their addresses.

#### Scenario: Address stored for a customer

- **WHEN** a complete address is saved for an existing customer
- **THEN** the address is stored and readable with that customer

#### Scenario: Address without a customer rejected

- **WHEN** an address is saved without an existing customer reference
- **THEN** the write is rejected

#### Scenario: Required address field missing

- **WHEN** an address is saved without a recipient name, address line 1, district, or division
- **THEN** the write is rejected

#### Scenario: Invalid recipient phone rejected

- **WHEN** an address is saved with a recipient phone that is not valid E.164
- **THEN** the write is rejected

#### Scenario: Delete a customer with addresses

- **WHEN** a customer that has addresses is deleted
- **THEN** those addresses are deleted with the customer
- **AND** no orphaned address rows remain

### Requirement: Customers have at most one default address per purpose

The system SHALL allow at most one default shipping address and one default billing address per
customer. A new default for a purpose MUST NOT coexist with another default for the same customer and
purpose, and the same address MAY be both the default shipping and default billing address.

#### Scenario: Default shipping address

- **WHEN** an address is saved as the default shipping address for a customer
- **THEN** it is stored as that customer's shipping default

#### Scenario: Second default shipping rejected

- **WHEN** a second address is saved as the default shipping address for the same customer
- **THEN** the write is rejected

#### Scenario: Default billing is independent

- **WHEN** a customer has a default shipping address and saves a different default billing address
- **THEN** both defaults are stored

#### Scenario: One address is both defaults

- **WHEN** a single address is saved as both default shipping and default billing
- **THEN** the write is accepted

#### Scenario: Defaults are scoped per customer

- **WHEN** two different customers each have a default shipping address
- **THEN** both defaults are accepted

### Requirement: OTP codes are hashed, expiring, and purpose-bound

The system SHALL store OTP records with a hashed code, a channel (`sms` or `email`), a purpose, a
normalized destination, a mandatory expiry, an optional consumption time, an optional invalidation
time, an attempt count, and a maximum attempt count. Raw OTP codes MUST NOT be stored. An OTP expiry
MUST be after its creation time, and the destination and purpose MUST match the selected channel.

#### Scenario: SMS login code stored hashed

- **WHEN** an SMS OTP for customer login is stored with a valid phone destination, a code hash, and a
  future expiry
- **THEN** the record is accepted and no raw code is present in the database

#### Scenario: Email verification code

- **WHEN** an email OTP for email verification is stored with a lowercase email destination and a
  future expiry
- **THEN** the record is accepted

#### Scenario: Expiry not after creation rejected

- **WHEN** an OTP is stored with an expiry equal to or before its creation time
- **THEN** the write is rejected

#### Scenario: Destination does not match channel

- **WHEN** an OTP is stored with an email channel and a phone destination, or an SMS channel and an
  email destination
- **THEN** the write is rejected

#### Scenario: Purpose does not match channel

- **WHEN** a phone verification OTP is stored with an email channel
- **THEN** the write is rejected

#### Scenario: Consumed OTP is recorded

- **WHEN** an OTP is consumed
- **THEN** its consumption time is recorded
- **AND** the consumed record remains queryable as history

#### Scenario: Superseded OTP is invalidated

- **WHEN** a new OTP is issued and the previous unconsumed OTP is retired
- **THEN** the previous record is marked invalidated
- **AND** its destination, purpose, channel, and creation time remain available

#### Scenario: OTP is consumed or invalidated, not both

- **WHEN** an OTP record carries both a consumption time and an invalidation time
- **THEN** the write is rejected

### Requirement: OTP verification attempts are bounded

The system SHALL record a non-negative attempt count and a positive maximum attempt count for every
OTP. The attempt count MUST NOT exceed the maximum, and verification MUST fail once the maximum is
reached.

#### Scenario: Attempts are tracked

- **WHEN** an OTP has recorded two failed verification attempts
- **THEN** the stored attempt count is 2

#### Scenario: Negative attempt count rejected

- **WHEN** an OTP is saved with a negative attempt count
- **THEN** the write is rejected

#### Scenario: Zero maximum rejected

- **WHEN** an OTP is saved with a maximum attempt count of zero
- **THEN** the write is rejected

#### Scenario: Attempts above maximum rejected

- **WHEN** an OTP is saved with an attempt count greater than its maximum attempt count
- **THEN** the write is rejected

### Requirement: OTP issuance history supports rate limiting

The system SHALL keep every OTP record with its destination, purpose, channel, and creation time. The
schema MUST allow multiple OTP records for one destination so the auth API can count issuance within a
time window and enforce rate limits.

#### Scenario: Multiple codes for one destination

- **WHEN** two OTP codes are issued for the same phone number and purpose at different times
- **THEN** both records are stored

#### Scenario: Issuance history is retained

- **WHEN** an OTP is consumed or superseded
- **THEN** its destination, purpose, channel, and creation time remain available
