## Purpose

Defines the storefront and administrative HTTP behavior for the shared catalog, so clients can
browse localized active merchandise and authorized staff can manage catalog records consistently.

## ADDED Requirements

### Requirement: Public catalog collections expose only active entities
The system SHALL provide paginated public listings of active categories and brands, and active products. A product SHALL be publicly listed only when its category and any assigned brand are active. Collection responses MUST use the documented page metadata and preserve stable ordering across pages.
When `locale` is omitted, storefront operations MUST use Bangla (`bn`).

#### Scenario: List public categories and brands
- **WHEN** a guest requests a category or brand collection with a supported locale and pagination
- **THEN** the response contains only active entities and the documented page metadata

#### Scenario: List public products
- **WHEN** a guest requests products
- **THEN** the response contains only active products whose category and assigned brand are active
- **AND** archived variants are not included as sellable variants

#### Scenario: Reject invalid pagination
- **WHEN** a guest requests a page below 1 or a page size above 100
- **THEN** the API returns a client error using the shared problem-details format

### Requirement: Storefront product browse filters use locale-aware catalog content
The system SHALL support the documented product query, category, and brand filters. Search MUST perform case-insensitive substring matching against the requested locale's product name and description. Category and brand filters MUST resolve the supplied localized slug in the requested locale. Results MUST remain paginated and stable when multiple records match.

#### Scenario: Search localized product content
- **WHEN** a guest searches products using `q` and a supported locale
- **THEN** matching products include case-insensitive substring matches in that locale's name or description

#### Scenario: Filter products by localized category and brand slugs
- **WHEN** a guest supplies category and/or brand filters
- **THEN** only products matching those slugs in the requested locale are returned

#### Scenario: Filter with an unknown or inactive slug
- **WHEN** a guest filters by a slug that does not resolve to an active category or brand in the requested locale
- **THEN** the result is an empty page and does not expose archived catalog records

### Requirement: Storefront detail routes resolve exact localized slugs
The system SHALL provide category products by localized category slug and product and brand details by localized slug. A detail route MUST return only active entities and MUST return not found when the requested locale has no matching translation; it MUST NOT silently substitute another locale. Product details MUST include the contract's localized content, active variants, and associated media metadata without exposing database-only fields.

#### Scenario: Read product and brand details
- **WHEN** a guest requests an active product or brand by a slug in the requested locale
- **THEN** the API returns the matching public representation described by the contract

#### Scenario: Read products for a category
- **WHEN** a guest requests products using an active category's localized slug
- **THEN** the API returns a paginated collection of active products assigned to that category

#### Scenario: Missing localized detail
- **WHEN** a guest requests a valid entity using a slug or locale translation that does not exist
- **THEN** the API returns a not-found problem and does not fall back to another locale

### Requirement: Administrative catalog operations require their declared current permissions
The system SHALL protect every administrative catalog operation with the corresponding permission declared in the OpenAPI contract. Authorization MUST use the authenticated admin's current role grants and scope. Admin collection reads MUST include archived records unless a documented filter requests a narrower set.

#### Scenario: Authorized administrator manages catalog records
- **WHEN** an active administrator with the operation's required permission and scope invokes an administrative catalog operation
- **THEN** the operation proceeds subject to catalog validation

#### Scenario: Administrator lacks permission or scope
- **WHEN** an administrator lacks the operation's current permission or required role scope
- **THEN** the API returns a forbidden problem without exposing protected catalog data

#### Scenario: Unauthenticated caller accesses administration
- **WHEN** a caller without a valid admin session invokes an administrative catalog operation
- **THEN** the API returns an unauthorized problem

### Requirement: Administrators can manage localized brands and categories
The system SHALL support the contract's brand and category listing, creation, update, and deletion operations. Writes MUST preserve existing translations that are omitted from an update and update only the locales provided. Localized slugs MUST be unique for the entity type and locale. Categories MUST reject self-parenting and any parent change that would create a hierarchy cycle. Deletion MUST respect existing child, product, and other database references.
Category and brand translations MUST persist and return every supported localized field accepted by their OpenAPI input, including an optional description.

#### Scenario: Create or update localized catalog content
- **WHEN** an authorized administrator submits brand or category content for one or more supported locales
- **THEN** the supplied locale records are persisted without overwriting omitted locales

#### Scenario: Persist an optional localized description
- **WHEN** an authorized administrator supplies a description for a category or brand locale
- **THEN** the description is stored and returned for that locale

#### Scenario: Reject duplicate localized slug
- **WHEN** an administrator creates or updates a slug already assigned to another entity of the same type and locale
- **THEN** the API returns a conflict problem and preserves the existing record

#### Scenario: Reject category hierarchy cycle
- **WHEN** an administrator assigns a category as its own ancestor
- **THEN** the API rejects the change and leaves the hierarchy unchanged

#### Scenario: Reject deletion of referenced category or brand
- **WHEN** an administrator deletes a category or brand that is still referenced by products or child categories
- **THEN** the API returns a conflict problem and preserves the referenced record

### Requirement: Administrators can manage category attribute definitions
The system SHALL provide paginated listing and creation of category-scoped attribute definitions. Attribute keys MUST be valid and unique within their category. Select definitions MUST contain options, and unsupported value types MUST be rejected.

#### Scenario: Create a category attribute definition
- **WHEN** an authorized administrator creates a valid definition for an existing category
- **THEN** the definition is stored and appears in that category's listing

#### Scenario: Reject duplicate or invalid definition
- **WHEN** an administrator submits a duplicate key in the same category or an invalid type/options combination
- **THEN** the API returns a validation or conflict problem and creates no definition

### Requirement: Administrators can manage products, variants, and catalog media associations
The system SHALL support the contract's product and variant listing, detail, create, update, and delete operations. Product writes MUST reference an existing category and any supplied brand or media records. Variant SKUs MUST be unique, prices MUST be non-negative integer poisha, and attributes MUST match the definitions for the product's category, including required values and select options. Product and variant status MUST use the contract's lifecycle values. Media associations MUST preserve requested order and primary-image selection. Deletion MUST respect references from other records.

#### Scenario: Create or update a valid product
- **WHEN** an authorized administrator submits a product with valid localized content and existing category, brand, and media references
- **THEN** the product and supplied locale/media associations are saved and returned using the documented schema

#### Scenario: Reject invalid product references or slug
- **WHEN** a product write references a missing category, brand, or media record, or conflicts with a localized slug
- **THEN** the API returns a not-found, validation, or conflict problem and does not partially apply the write

#### Scenario: Create or update a valid variant
- **WHEN** an authorized administrator submits a variant with a unique SKU, valid integer prices, and category-conforming attributes
- **THEN** the variant is saved and returned using the documented schema

#### Scenario: Reject invalid variant values
- **WHEN** a variant has a duplicate SKU, a negative/non-integer price, an unknown attribute key, a wrong value type, a missing required value, or an option outside its select definition
- **THEN** the API returns a validation or conflict problem and preserves the existing variant

#### Scenario: Reject deletion of a referenced product or variant
- **WHEN** a product or variant is referenced by another persisted business record
- **THEN** the API returns a conflict problem and preserves the referenced record

### Requirement: Catalog errors use the shared problem-details contract
The system SHALL serialize catalog validation, not-found, conflict, and authorization failures using RFC 9457 problem details with stable machine-readable codes. Responses MUST NOT expose stack traces, SQL, credentials, or internal database errors.

#### Scenario: Invalid catalog input
- **WHEN** a request contains malformed fields or violates catalog constraints
- **THEN** the API returns a client error with field-level details where available and no sensitive implementation detail

#### Scenario: Unexpected persistence failure
- **WHEN** an unhandled persistence failure occurs
- **THEN** the API returns a generic internal problem without exposing SQL or internal exception messages
