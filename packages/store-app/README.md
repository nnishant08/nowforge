# NowForge — ServiceNow Scoped App (`x_nowfg_nowforge`)

This package contains the **server-side** half of NowForge: a scoped application that runs *on* a ServiceNow instance. The browser extension and VS Code extension talk to it over REST.

The scope name is `x_nowfg_nowforge`. The app surface:

| Layer | Files |
|---|---|
| Tables | `src/tables/*.json` |
| Script Includes | `src/script-includes/*.js` |
| Business Rules | `src/business-rules/*.js` |
| Scripted REST API | `src/rest-api/endpoints/*.js` |
| UI Pages | `src/ui/pages/*.html` |
| Scheduled Jobs | `src/scheduled-jobs/*.js` |
| Properties | `src/properties/system-properties.json` |

## Why files, not a published app

Local Node code can't compile or deploy a ServiceNow scoped app directly. This package is the **source of truth** — copy-paste each script into the corresponding SN record, or use the `now-sdk` CLI once you've registered as a Technology Partner. Either way, the JS lives in Git.

## Install on a PDI

1. Create a new Custom Application:
   - **Name:** NowForge
   - **Scope:** `x_nowfg_nowforge`
2. Create the tables defined in `src/tables/*.json`:
   - For each JSON file, create a table with the listed extends/label, then add each field from the `fields` array.
3. Create the Script Includes from `src/script-includes/*.js`:
   - **Application:** NowForge (the scoped app you just made)
   - **Client callable:** depends on the file (header comment notes this)
4. Create the Business Rules from `src/business-rules/*.js`:
   - **Application:** NowForge
   - Apply the table/when/order from the file's header comment
5. Create the Scripted REST API at `/api/x_nowfg_nowforge/v1` with the resources in `src/rest-api/endpoints/*.js`
6. Create the UI Pages from `src/ui/pages/*.html`
7. Create the Scheduled Jobs from `src/scheduled-jobs/*.js`
8. Create the system properties from `src/properties/system-properties.json`

## Update Set export

Once everything is in place on a PDI, use **System Update Sets → Local Update Sets**, mark all your changes complete, and export the XML. Drop the XML in `update-set/` so future installations are one import away.

## Compatibility

- ServiceNow Yokohama or later
- Tested on PDI; production-grade requires final review by your platform team
