# BMRMODZ Notification Tool v0.1.1

Central, experimental KOMBI notification display tool for iDrive 7 MGU. DPF and future apps call `require('./kit/notification-tool').show(app, segments, options)`. Text rasterization happens in the shared client (using MGU Canvas/font atlas); the HU tool receives only rendered RGBA and controls time, blink, repeat and cleanup. DPF no longer opens cluster-render itself.

## API
```js
const notify=require('./kit/notification-tool');
notify.show('dpf',[
  {text:'DPF Regeneration: ',color:'#ffffff'},
  {text:'Started',color:'#ff2a2a'}
],{durationMs:3000,blinkMs:500,repeat:1,repeatIntervalMs:0});
```
App sends localized message segments, not locale keys. Inputs: durationMs 500–15000; blinkMs 0 (solid) or 1–3000; repeat 1–10; repeatIntervalMs 0–60000. Total run limited to 120 seconds. One active message; concurrent requests respond `{ok:false,error:'busy'}`. App must inspect the response. HU socket `/run/bmrmodz-notification/ctl.sock`. Renderer `/dev/shm/cluster-render/render.sock`. Tool owns panel x745 y539 430x76 and calls `drop` on completion.

The tool returns `sent_to_renderer`, **not** a real car display acknowledgment. Socket permission matches Car Equipment for first integration, local clients must be trusted.

## Testing
`node tools/notification/test.js` (mock renderer), `node apps/dpf/regen-message.test.js`. Install via MGU Store dependency `bmrmodz-notification >=0.1.1` in DPF v0.1.56. Test only while parked.

**Known blocker:** renderer can replace the BMW BC information slot. This change does not fix the BC conflict. No guarantee of BMW original content restoration; HUD output remains unsupported.
