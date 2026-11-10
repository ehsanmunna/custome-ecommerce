## Purpose

Provides administrative media upload and delivery for catalog and CMS content, supporting plan.md
items 9 (uploads to the client's Cloudflare R2) and 23 (media management). Objects are uploaded
directly to R2 through short-lived presigned URLs; the API stores and returns metadata, public
delivery URLs, and image resizing variants.

## ADDED Requirements

### Requirement: Media administration requires media permissions and store scope

The system SHALL require bearer administrator authentication for every media operation. Listing
MUST require media read access; upload creation, completion, and deletion MUST require media manage
access. Operations MUST also enforce the store role scope. The baseline permission catalog SHALL
include `media_read` and `media_manage`, granted to the owner and manager roles, with `media_read`
also granted to staff.

#### Scenario: Authorized administrator manages media

- **WHEN** an active administrator with the required media permission and store scope lists,
  creates, completes, or deletes media
- **THEN** the operation is allowed

#### Scenario: Administrator lacks media permission or scope

- **WHEN** an administrator lacks the operation's media permission or has a non-store role scope
- **THEN** the request is rejected as forbidden and no media data or storage instruction is returned

#### Scenario: Baseline media grants are seeded

- **WHEN** the baseline seed runs on a migrated database
- **THEN** `media_read` and `media_manage` exist, owner and manager receive both, and staff receive
  `media_read`

### Requirement: Administrators can list media assets

The system SHALL return paginated media assets using the contract's `page` and `pageSize`
parameters, defaulting to the documented values and enforcing the documented maximum. Results MUST
use stable newest-first ordering with a deterministic tie-breaker so repeated requests do not
duplicate or skip records. Each asset MUST include its identifier, provider, storage key, MIME type,
exact non-negative byte size, known dimensions, localized alt text, and public delivery URL.

#### Scenario: List a page of media

- **WHEN** an authorized administrator requests a page of media
- **THEN** the response contains the requested page metadata and mapped media assets only

#### Scenario: Stable pagination across pages

- **WHEN** assets share the same creation time and the administrator requests consecutive pages
- **THEN** each asset appears on exactly one page in a deterministic order

#### Scenario: List media when storage is unconfigured

- **WHEN** the R2 configuration required for delivery URLs is absent or invalid
- **THEN** the request fails with service unavailable rather than returning incomplete URLs

### Requirement: Administrators can request a direct upload

The system SHALL create a media upload intent from a non-empty file name, an allowed image MIME
type, a positive byte size within the configured upload limit, and optional Bangla and English alt
text. It MUST persist a media asset with the R2 provider, a server-generated storage key, the
declared type and size, and the provided alt text, and MUST return the created asset with a
short-lived presigned PUT instruction containing the upload URL, method, required headers, and
expiry. The storage key MUST NOT be derived from untrusted path components. Requests with an
unsupported MIME type, non-positive size, or size above the configured limit MUST be rejected
without creating a record.

#### Scenario: Create an upload intent

- **WHEN** an authorized administrator submits a valid image file name, MIME type, and byte size
- **THEN** a media record is persisted and the response includes a presigned PUT instruction whose
  required content type matches the declared MIME type

#### Scenario: Reject an unsupported or oversized upload

- **WHEN** the requested MIME type is not an allowed image type or the byte size exceeds the
  configured limit
- **THEN** the request is rejected and no media record is created

#### Scenario: Localized alt text is persisted

- **WHEN** an upload intent includes Bangla and English alt text
- **THEN** both values are returned with the asset and remain independently readable

### Requirement: Upload completion verifies the stored object

The system SHALL provide an additive completion operation for a media asset. Completion MUST verify
that the object exists in R2 and MUST derive authoritative byte size and MIME type from the stored
object rather than trusting client claims. It MUST accept optional image width and height only when
both are positive or both are absent, and MUST persist them with the asset. Missing objects MUST be
reported as a conflict, and objects exceeding the configured size limit or having an unsupported
type MUST be rejected. Repeating completion for an already completed asset MUST return the same
metadata without creating duplicate records or alt text.

#### Scenario: Complete a successful upload

- **WHEN** the object exists in R2 and the administrator supplies valid image dimensions
- **THEN** the media record is updated with verified size, MIME type, and dimensions and returned

#### Scenario: Complete before the object exists

- **WHEN** completion is requested but the presigned upload was never performed or the object is
  absent from R2
- **THEN** the request fails as a conflict and the media record remains unverified

#### Scenario: Repeat completion

- **WHEN** completion is requested again for the same asset
- **THEN** the same verified metadata is returned and no duplicate data is created

#### Scenario: Reject invalid dimensions

- **WHEN** only one dimension is supplied, a dimension is negative, or the stored object is not an
  allowed image within the size limit
- **THEN** the request is rejected and the asset is not marked verified

### Requirement: Assets use public delivery URLs and deterministic image variants

The system SHALL build media delivery URLs from the configured public R2 base URL and the asset's
storage key. For image assets, when image resizing is enabled, it SHALL also expose deterministic
`thumbnail`, `card`, `detail`, and `large` variants using Cloudflare Image Resizing with automatic
format selection. Delivery URLs MUST be stable, require no per-request signing, and MUST NOT leak
credentials.

#### Scenario: Original and resized URLs

- **WHEN** an image asset is returned and public delivery and resizing are configured
- **THEN** the response contains the original URL and the four named variant URLs derived from the
  same key

#### Scenario: Resizing disabled

- **WHEN** image resizing is disabled in configuration
- **THEN** the response contains the original URL and omits the variant URLs

### Requirement: Media deletion removes metadata and attempts object cleanup

The system SHALL delete a media asset by identifier, removing its alt text and catalog associations
through the existing database cascade and setting category, brand, and banner references to null. It
MUST return no content when the record existed and not found when it did not. After the database
deletion, it MUST attempt to delete the R2 object; a storage cleanup failure MUST NOT restore the
record or change the successful response, and MUST be recorded for operators.

#### Scenario: Delete an associated asset

- **WHEN** an authorized administrator deletes a media asset referenced by catalog or CMS content
- **THEN** the media record and its alt text are removed, referencing records remain with null image
  references or removed product links, and the request returns no content

#### Scenario: Delete an unknown asset

- **WHEN** the requested media identifier does not exist
- **THEN** the request returns not found

#### Scenario: Object cleanup fails

- **WHEN** the database record is deleted but R2 object deletion fails
- **THEN** the response remains successful and the failure is logged without exposing storage
  internals
