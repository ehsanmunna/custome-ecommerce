## Purpose

Defines the shared catalog data model every client database uses: categories, brands, products,
variants, category-scoped attribute definitions, and Bangla/English content with SEO fields. This
covers plan.md items 4 and 6 and is the foundation for inventory, orders, the admin catalog, and the
storefront.

## ADDED Requirements

### Requirement: Categories form a controlled hierarchy

The system SHALL store categories with an optional parent category, a stable identifier, a sort
order, and an archive status. A category MUST NOT use itself as its parent, and every parent
reference MUST point to an existing category.

#### Scenario: Nested category

- **WHEN** a category is created with an existing category as its parent
- **THEN** the new category is stored beneath the parent
- **AND** the parent-child relationship can be read back

#### Scenario: Self-parent rejected

- **WHEN** a category is saved with its own identifier as the parent
- **THEN** the write is rejected

#### Scenario: Unknown parent rejected

- **WHEN** a category is saved with a parent identifier that does not exist
- **THEN** the write is rejected

### Requirement: Localized catalog content is stored per locale

Categories, brands, products, and media alt text SHALL support separate Bangla (`bn`) and English
(`en`) content. Each entity MUST have at most one content row per locale, and writing one locale
MUST NOT overwrite the other.

#### Scenario: Both locales coexist

- **WHEN** a product has one `bn` content row and one `en` content row
- **THEN** both rows remain readable independently

#### Scenario: Duplicate locale rejected

- **WHEN** a second `en` content row is written for the same entity
- **THEN** the write is rejected

#### Scenario: Unsupported locale rejected

- **WHEN** a content row is written with a locale other than `bn` or `en`
- **THEN** the write is rejected

### Requirement: Localized SEO identity is unique

Each category, brand, and product SHALL have a localized slug and MAY provide a meta title and meta
description. The slug MUST be unique within its entity type and locale so storefront URLs cannot
collide.

#### Scenario: Unique product slug

- **WHEN** two products have the same `en` slug
- **THEN** the second product content write is rejected

#### Scenario: Same slug in another locale

- **WHEN** two products use the same slug but different locales
- **THEN** both content rows are accepted

#### Scenario: Duplicate category slug rejected

- **WHEN** two categories have the same `bn` slug
- **THEN** the second category content write is rejected

### Requirement: Brands are optional catalog entities

The system SHALL store brands with localized content and an archive status. A product MAY reference
one brand, and a brand reference MUST point to an existing brand.

#### Scenario: Product references a brand

- **WHEN** a product is saved with an existing brand
- **THEN** the association is stored and readable

#### Scenario: Unknown brand rejected

- **WHEN** a product is saved with a brand identifier that does not exist
- **THEN** the write is rejected

### Requirement: Products belong to one category and have a lifecycle status

Every product SHALL reference exactly one existing category and MUST have a status of `draft`,
`active`, or `archived`. A product MUST NOT be created without a category, and an unsupported status
MUST be rejected.

#### Scenario: Product created in a category

- **WHEN** a product is saved with an existing category and the `draft` status
- **THEN** the product is stored and linked to that category

#### Scenario: Product without category rejected

- **WHEN** a product is saved without a category
- **THEN** the write is rejected

#### Scenario: Unsupported product status rejected

- **WHEN** a product is saved with a status outside `draft`, `active`, or `archived`
- **THEN** the write is rejected

### Requirement: Variants are the sellable unit

Every sellable item SHALL be a variant of one product. A variant MUST have a catalog-unique SKU, a
non-negative integer price in poisha, an optional non-negative compare-at price in poisha, a status,
and a sort order.

#### Scenario: Variant stored with integer price

- **WHEN** a variant is saved with price `125000` poisha
- **THEN** the exact integer value is readable back as ৳1,250.00

#### Scenario: Duplicate SKU rejected

- **WHEN** two variants are saved with the same SKU
- **THEN** the second write is rejected

#### Scenario: Negative price rejected

- **WHEN** a variant is saved with a negative price
- **THEN** the write is rejected

#### Scenario: Variant requires a product

- **WHEN** a variant is saved without an existing product reference
- **THEN** the write is rejected

### Requirement: Attribute definitions are scoped to a category

The system SHALL store typed attribute definitions per category. Each definition MUST have a key
unique within its category, a value type, a required flag, a filterable flag, and a sort order.
Select definitions SHALL carry their allowed options.

#### Scenario: Same attribute key in different categories

- **WHEN** `size` is defined for both the clothes and shoes categories
- **THEN** both definitions are accepted

#### Scenario: Duplicate attribute key in one category

- **WHEN** `size` is defined twice for the same category
- **THEN** the second definition is rejected

#### Scenario: Unsupported attribute type rejected

- **WHEN** a definition is saved with a value type outside the supported set
- **THEN** the write is rejected

### Requirement: Variant attributes are flexible JSONB data

Variant attribute values SHALL be stored as a JSON object so each category can define different
attributes without schema changes. The catalog MUST NOT require a dedicated column per attribute.

#### Scenario: Arbitrary attributes for one variant

- **WHEN** a variant stores `{"color":"red","size":"M"}`
- **THEN** the complete object is readable back unchanged

#### Scenario: Different shapes across categories

- **WHEN** a clothes variant stores color and size and a diapers variant stores weight range and pack size
- **THEN** both variants are stored in the same catalog structure

### Requirement: Catalog references cannot leave orphans

The system SHALL protect catalog integrity. A category that still contains child categories or
products MUST NOT be deleted, and deleting a product SHALL remove its own variants, translations, and
media associations rather than leaving orphan rows.

#### Scenario: Delete a category with products

- **WHEN** a category that still has products is deleted
- **THEN** the delete is rejected

#### Scenario: Delete a category with children

- **WHEN** a category that still has child categories is deleted
- **THEN** the delete is rejected

#### Scenario: Delete a product

- **WHEN** a product is deleted
- **THEN** its variants, translations, and media associations are removed with it
- **AND** no orphaned catalog rows remain
