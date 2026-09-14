# Easter egg assets

`trump-headshot.jpg` — used by the USA-click rain easter egg (`src/components/EasterEgg/TrumpRain.tsx`).

| | |
|---|---|
| Source | Official White House portrait of President Donald J. Trump |
| Photographer | Shealah Craighead (White House photographer) |
| Date | October 6, 2017 |
| Original | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Donald_Trump_official_portrait.jpg) — 2250×2850 |
| License | Public domain — a work of the U.S. federal government (17 U.S.C. § 105), same category as the NASA imagery in `public/textures/` |

Cropped to a square around the face and downscaled to 200×200 here (vendored rather than hotlinked, like the
globe textures, because the site's CSP is `img-src 'self' data:`).

Note: the original file's embedded caption is the White House's standard photo-use notice, which asks that
official photos be used for news publication or personal use by their subject and not for commercial/political
promotion or in a way implying endorsement — the government has no copyright to enforce that with (per the
public-domain status above), but it reflects the intended spirit of the photo. This use (an unmodified,
non-commercial, non-political parody-screensaver easter egg in a personal side project) doesn't do any of the
things the notice asks against, but worth knowing if this ever gets repurposed elsewhere.
