## Purpose

Defines persisted, localized storefront pages and banners that can be prepared and published independently for Bangla and English. It provides content and publication metadata without prescribing an editor or storefront rendering implementation.

## ADDED Requirements

### Requirement: Pages store localized content and unique slugs

The system SHALL store CMS pages with localized content for supported locales `bn` and `en`. Each translation MUST have a non-empty slug that is unique among pages for that locale. Page content MUST be stored independently of catalog records, and SEO title and description MAY be stored per translation.

#### Scenario: Localized page translations stored
- **WHEN** Bangla and English translations are saved for the same page
- **THEN** each locale's content and SEO metadata are stored independently

#### Scenario: Duplicate page slug for one locale rejected
- **WHEN** a page translation is saved with a slug already used by another page in the same locale
- **THEN** the write is rejected

#### Scenario: Same slug allowed in different locales
- **WHEN** two translations in different supported locales use the same slug
- **THEN** both translations are accepted

#### Scenario: Empty slug rejected
- **WHEN** a page translation is saved with an empty slug
- **THEN** the write is rejected

### Requirement: Page translations have explicit publication states

The system SHALL store each page translation with a publication state of `draft`, `published`, or `archived`. A new translation MUST default to `draft`. Unsupported locales or publication states MUST be rejected.

#### Scenario: New translation defaults to draft
- **WHEN** a page translation is created without an explicit publication state
- **THEN** it is stored as `draft`

#### Scenario: Translation publication state changed
- **WHEN** a translation is changed to a supported publication state
- **THEN** the state is stored for that locale without changing another locale's state

#### Scenario: Unsupported locale or state rejected
- **WHEN** a translation is saved with an unsupported locale or publication state
- **THEN** the write is rejected

### Requirement: Banners store localized presentation and placement

The system SHALL store banners with a stable placement key, ordering value, active state, and localized content for `bn` and `en`. A banner MAY reference an existing media asset and MAY include a destination URL. Deleting a referenced media asset MUST preserve the banner and clear its media reference.

#### Scenario: Localized banner stored
- **WHEN** banner text and destination content are saved for supported locales and a placement
- **THEN** the banner content, placement, ordering, and active state are stored

#### Scenario: Banner may omit a locale translation
- **WHEN** a banner is created with content for only one supported locale
- **THEN** the provided translation is stored without requiring the other locale

#### Scenario: Unknown media asset rejected
- **WHEN** a banner references a media asset that does not exist
- **THEN** the write is rejected

#### Scenario: Deleting banner media preserves banner
- **WHEN** a media asset referenced by a banner is deleted
- **THEN** the banner remains and its media reference is cleared

### Requirement: CMS records preserve content until intentionally removed

The system SHALL preserve page content and banner content when unrelated CMS records change. Deleting a page SHALL delete its translations. Deleting a banner SHALL delete its translations.

#### Scenario: Page deletion removes translations
- **WHEN** a page with translations is deleted
- **THEN** its translations are deleted and unrelated pages remain

#### Scenario: Banner deletion removes translations
- **WHEN** a banner with translations is deleted
- **THEN** its translations are deleted and unrelated banners remain
