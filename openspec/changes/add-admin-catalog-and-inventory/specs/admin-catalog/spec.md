# Spec Delta

## Purpose

Lets store operators manage products, categories, brands, attributes, variants, and media through the admin dashboard.

## ADDED Requirements

### Requirement: Product management
The system SHALL allow admins to create, read, update, and delete products through the admin dashboard, with each product linked to a category, brand, attributes, variants, SEO fields, and media assets.

#### Scenario: Create a product
- **WHEN** an admin submits a product form with valid name, category, brand, price, and at least one variant
- **THEN** the product is created and appears in the product list

#### Scenario: Edit a product
- **WHEN** an admin edits an existing product's name or price and saves
- **THEN** the product list reflects the updated values

#### Scenario: Delete a product
- **WHEN** an admin deletes a product that has no orders
- **THEN** the product is removed from the product list and no longer accessible

### Requirement: Category management
The system SHALL allow admins to create, read, update, and delete categories, with parent/child hierarchy support and Bangla/English translations for category names and descriptions.

#### Scenario: Create a category
- **WHEN** an admin submits a category form with a unique name in both bn and en locales
- **THEN** the category is created and available for product assignment

#### Scenario: Create a child category
- **WHEN** an admin creates a category with a parent category selected
- **THEN** the child category appears under its parent in the category tree

### Requirement: Brand management
The system SHALL allow admins to create, read, update, and delete brands.

#### Scenario: Create a brand
- **WHEN** an admin submits a brand form with a unique brand name
- **THEN** the brand is created and available for product assignment

### Requirement: Attribute definitions
The system SHALL allow admins to define attribute definitions per category, specifying attribute name, type, and allowed values, so the product form can render category-specific fields.

#### Scenario: Define category attributes
- **WHEN** an admin adds attribute definitions for a category (e.g., color and size for clothing)
- **THEN** the product form for that category renders the defined attributes

### Requirement: Variant management
The system SHALL allow admins to create product variants from attribute combinations, with per-variant SKU, price, and stock quantity.

#### Scenario: Create a variant
- **WHEN** an admin selects attribute values (e.g., color=red, size=M) for a product
- **THEN** a variant is created with a unique SKU and linked to the product

### Requirement: Media management
The system SHALL allow admins to upload product images to Cloudflare R2 and associate them with products or variants.

#### Scenario: Upload a product image
- **WHEN** an admin uploads an image file for a product
- **THEN** the image is stored in R2 and a media URL is returned for display on the product

#### Scenario: Associate media with a variant
- **WHEN** an admin selects a media asset for a specific variant
- **THEN** the variant displays that media in the product detail view
