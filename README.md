# BMRMODZ — BMW MGU Apps

<p align="center">
  <a href="https://www.instagram.com/bmrmodz">Instagram</a>
  ·
  <a href="https://www.facebook.com/profile.php?id=61590181470490">Facebook</a>
  ·
  <a href="https://github.com/dzooky">GitHub</a>
</p>

Independent repository for BMRMODZ's custom BMW MGU / iDrive 7 applications.

## Applications

- **Oil Service Assistant (OSA)** — An independent BMW MGU application designed to support engine and transmission oil service operations. It monitors vehicle parameters and provides an estimate of the time required to complete individual service procedures, helping users understand how long an oil service may take and when it is expected to be completed.
- **DPF tools** — DPF is in build phase.

## Find BMRMODZ

Follow the project on social media, or scan the QR codes below to open the pages directly.

<table>
  <tr>
    <th align="center">Instagram</th>
    <th align="center">Facebook</th>
  </tr>
  <tr>
    <td align="center">
      <a href="https://www.instagram.com/bmrmodz">
        <img src="apps/osa/qr_instagram.png" alt="BMRMODZ Instagram QR code" width="180">
      </a>
    </td>
    <td align="center">
      <a href="https://www.facebook.com/profile.php?id=61590181470490">
        <img src="apps/osa/qr_facebook.png" alt="BMRMODZ Facebook QR code" width="180">
      </a>
    </td>
  </tr>
</table>

## Build

The repository follows the MGU Store repository format in `mgu-repo.json`.

The repository is configured for **mgu-store** to build OSA on the head unit.
The Store supplies the BMW SDK donor and links the SDK into the app during its
source build. The build script therefore omits `node_modules/oap-sdk` from the
published package; BMW's SDK is not redistributed.

For a standalone local build (outside mgu-store), the SDK must first be extracted
from an app on your own head unit with:

```sh
node kit/tools/extract_sdk.js /path/to/app.js
python3 kit/tools/build.py osa
```

Keep the generated `oap-sdk/` directory local; it is intentionally not committed.

## Credits and licensing

The shared MGU runtime, build tooling and renderer are carried over from the MIT-licensed MGU Custom Apps project. See [LICENSE](LICENSE) and the renderer licenses in `kit/renderd/prebuilt/`.

Only the files required for BMRMODZ applications are included; unrelated apps from the source repository are not copied.
