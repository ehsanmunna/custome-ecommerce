## Purpose

Defines coupon codes, discount rules, validity limits, and redemption tracking for the shared order
schema. It covers the coupon part of plan.md item 5 and is the foundation for the future checkout and
admin promotion features.

## ADDED Requirements

### Requirement: Coupon codes are unique and normalized

The system SHALL store coupon codes in uppercase and MUST reject duplicate codes. A code MUST be a
non-empty identifier made of uppercase letters, digits, underscores, or hyphens. A new coupon MAY be
stored as inactive.

#### Scenario: Coupon created

- **WHEN** a coupon is saved with a unique uppercase code
- **THEN** the coupon is stored

#### Scenario: Duplicate coupon code rejected

- **WHEN** a second coupon is saved with an existing code
- **THEN** the write is rejected

#### Scenario: Mixed-case coupon code rejected

- **WHEN** a coupon code contains lowercase letters
- **THEN** the write is rejected

#### Scenario: Invalid coupon code rejected

- **WHEN** a coupon code is empty or contains spaces or unsupported characters
- **THEN** the write is rejected

### Requirement: Coupons use supported discount types and valid values

The system SHALL store a coupon discount type of `percentage` or `fixed`. A percentage discount MUST be
between 1 and 100 inclusive. A fixed discount MUST be positive, and every coupon MUST have a
non-negative minimum-order amount in poisha. An unsupported discount type MUST be rejected.

#### Scenario: Percentage coupon created

- **WHEN** a percentage coupon is saved with a value between 1 and 100
- **THEN** the coupon is stored

#### Scenario: Fixed coupon created

- **WHEN** a fixed coupon is saved with a positive amount
- **THEN** the coupon is stored

#### Scenario: Percentage above 100 rejected

- **WHEN** a percentage coupon is saved with a value greater than 100
- **THEN** the write is rejected

#### Scenario: Zero fixed discount rejected

- **WHEN** a fixed coupon is saved with a value of zero or less
- **THEN** the write is rejected

#### Scenario: Negative minimum order rejected

- **WHEN** a coupon is saved with a negative minimum-order amount
- **THEN** the write is rejected

#### Scenario: Unsupported discount type rejected

- **WHEN** a coupon is saved with a discount type outside `percentage` and `fixed`
- **THEN** the write is rejected

### Requirement: Coupons have a validity window and optional usage limits

The system SHALL store a validity start time and expiry time, with the start strictly before the
expiry. A coupon MAY have a total usage limit and a per-customer usage limit; when present, each limit
MUST be positive.

#### Scenario: Valid window stored

- **WHEN** a coupon is saved with a start time before its expiry
- **THEN** the coupon is stored

#### Scenario: Invalid validity window rejected

- **WHEN** a coupon start time is equal to or after its expiry
- **THEN** the write is rejected

#### Scenario: Zero total usage limit rejected

- **WHEN** a coupon is saved with a total usage limit of zero
- **THEN** the write is rejected

#### Scenario: Zero per-customer limit rejected

- **WHEN** a coupon is saved with a per-customer usage limit of zero
- **THEN** the write is rejected

#### Scenario: Limits may be omitted

- **WHEN** a coupon is saved without usage limits
- **THEN** the coupon is accepted as unlimited within its validity window

### Requirement: Coupon redemptions link one coupon to one order

The system SHALL record each coupon redemption with the coupon, the order, the optional customer, and
the discount amount in poisha. An order MUST have at most one redemption, so coupons MUST NOT stack. The
discount amount MUST be positive. A coupon with redemptions MUST NOT be deleted, and an order with a
redemption MUST NOT be deleted.

#### Scenario: Coupon redeemed on an order

- **WHEN** a coupon is redeemed on an order with a positive discount
- **THEN** the redemption is stored and readable

#### Scenario: Second coupon on one order rejected

- **WHEN** a second redemption is recorded for the same order
- **THEN** the write is rejected

#### Scenario: Zero discount redemption rejected

- **WHEN** a redemption is recorded with a zero or negative discount
- **THEN** the write is rejected

#### Scenario: Unknown coupon rejected

- **WHEN** a redemption references a coupon that does not exist
- **THEN** the write is rejected

#### Scenario: Delete a redeemed coupon rejected

- **WHEN** a coupon with redemptions is deleted
- **THEN** the delete is rejected

#### Scenario: Guest redemption

- **WHEN** a coupon is redeemed on a guest order without a customer reference
- **THEN** the redemption is accepted

### Requirement: Coupon usage limits are enforceable from redemption history

The system SHALL derive total and per-customer usage from redemption rows. A coupon MUST NOT be redeemed
after its expiry or beyond its total usage limit, and a registered customer MUST NOT exceed the coupon's
per-customer limit. Guest redemptions count toward the total limit only.

#### Scenario: Total limit reached

- **WHEN** a coupon has reached its total usage limit
- **THEN** another redemption is rejected

#### Scenario: Per-customer limit reached

- **WHEN** a registered customer has reached the coupon's per-customer limit
- **THEN** another redemption by that customer is rejected

#### Scenario: Expired coupon rejected

- **WHEN** a coupon is redeemed after its expiry time
- **THEN** the redemption is rejected
