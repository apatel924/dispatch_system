# Proof Upload — Mobile QA Checklist

Manual verification for driver proof capture on real devices before production release.

## Devices & browsers

- [ ] iPhone Safari — camera capture (`capture="environment"`)
- [ ] iPhone Safari — gallery picker
- [ ] Android Chrome — camera capture
- [ ] Android Chrome — gallery picker

## Orientation & image quality

- [ ] Portrait photo — displays upright after attach (EXIF orientation)
- [ ] Landscape photo — displays upright after attach
- [ ] Prepared size shown before upload is under ~500 KB for typical exterior photo
- [ ] ID verification photo (when enabled) remains readable at arm's length
- [ ] Signature strokes remain legible after light PNG preparation

## Network & resilience

- [ ] Poor network (throttled 3G) — upload completes or shows retry error
- [ ] Failed upload — "Retry upload" button re-submits from local storage
- [ ] Double-tap Attach / Save — only one upload request fires
- [ ] App backgrounded mid-upload — returns to correct state (uploading or error)

## Large originals

- [ ] 5–10 MB original camera image — client prepares to acceptable size
- [ ] Upload succeeds without 413 / body-too-large errors

## Security (smoke)

- [ ] Browser Network tab shows `POST /api/orders/{id}/proofs` only (no direct Firebase Storage SDK upload)
- [ ] Firebase Storage rules remain deny-all for client SDK

## Server errors (staging)

- [ ] Oversized payload returns 413 with safe message
- [ ] Unassigned driver receives 404/403
- [ ] Rate-limited burst returns 429

## Sign-off

| Tester | Device | Date | Pass/Fail | Notes |
|--------|--------|------|-----------|-------|
|        |        |      |           |       |
