# Selling Photobook Studio

How it works for your customer:

1. They download the **trial**. Everything works except **Export**, which is greyed out with a lock.
2. They click **Export** (or the **Trial** button). A window explains the full version and shows **Buy now**.
3. **Buy now** opens your secure payment page in their browser (Paystack).
4. Paystack tells your **license server** the payment succeeded. It creates a signed license key and emails it.
5. The customer pastes the key into the app → **Activate license** → the app is fully unlocked, Export included.

The license check happens inside the app's main process, not just on screen, so the Export button can't be
switched back on by editing the page.

---

## One-time setup (about an hour)

### 1. Make your license keys
On your own computer, in the project folder:
```
npm install
node tools/gen-keys.js
```
This creates **`keys/private.pem`**, the secret that makes license keys, and puts the matching public key in
`license-public.json` (that file ships inside the app).

> **Back up `keys/private.pem` somewhere safe (not in the cloud folder you share).**
> Never put it in the app, in git, or in an email. If you lose it you can't issue keys that existing
> copies of the app accept. If it leaks, anyone can make keys. `tools/`, `keys/` and `license-server/`
> are never included in the app you ship.

### 2. Set your price and links, in `app-config.json`
```json
{
  "productName": "Photobook Studio",
  "price": "₦49,000",
  "buyUrl": "https://paystack.com/pay/your-page",
  "licenseServer": "https://YOUR-SERVER",
  "supportEmail": "you@yourdomain.com"
}
```
`buyUrl` must start with `https://`. It's the page the **Buy now** button opens. `licenseServer` turns on online activation (step 4b); leave it empty to use keys that work fully offline.

### 3. Paystack (payments for Nigeria; cards, transfer, USSD)
1. Create an account at paystack.com and finish business verification.
2. Create a **Payment Page** (or Product) for a fixed price. Put its link in `buyUrl`.
3. Dashboard → Settings → API Keys → copy the **Secret key**.
4. Dashboard → Settings → API Keys & Webhooks → set the **Webhook URL** to
   `https://YOUR-SERVER/paystack-webhook` (step 4).
5. Test everything in Paystack **test mode** before going live.

*Selling worldwide in dollars or want tax handled for you?* Lemon Squeezy, Paddle and Gumroad act as the seller
and handle VAT. Check they pay out to Nigeria first. You can still use this app's keys with them: create the
key by hand with `node tools/make-key.js buyer@email.com` after each sale, or adapt `license-server/server.js`.

### 4. Put the license server online
`license-server/server.js` needs only Node 18+. Any small host works (Render, Railway, Fly.io, a cheap VPS).

Set these environment variables on the host (see `license-server/.env.example`):

| Variable | What |
|---|---|
| `PAYSTACK_SECRET` | Paystack secret key |
| `LICENSE_PRIVATE_KEY_B64` | printed by `gen-keys.js` |
| `CURRENCY`, `MIN_AMOUNT_MINOR` | e.g. `NGN` and `4900000` (price in kobo). Lower payments are ignored |
| `RESEND_API_KEY`, `FROM_EMAIL` | free account at resend.com, used to email the key |
| `ADMIN_TOKEN` | long random secret, for `tools/admin.js` |
| `MAX_DEVICES`, `TOKEN_DAYS`, `DATA_DIR` | computers per key (3), offline days (30), persistent folder |

Start command: `node license-server/server.js`. Check `https://YOUR-SERVER/health` says `ok`.

The server rejects anything not signed by Paystack, ignores wrong amounts and currencies, and sends only one
key per payment even if Paystack retries. It stores paid references and activations in `data.json`; on hosts that wipe the
disk, attach a persistent disk or the same payment could be re-issued on a retry.

### 3b. Selling without a website (bank transfer, WhatsApp)
After you receive the money:
```
node tools/make-key.js customer@email.com
```
Send the key to the customer. This works with no server at all.

### 5. Build the apps
Run **after** step 1 so the public key is inside the app:
```
npm run dist:win     # on Windows → dist\Photobook Studio Setup x.y.z.exe
npm run dist:mac     # on a Mac   → dist/Photobook Studio-x.y.z.dmg
```
Everyone downloads the **same file**: it's the trial until a key is entered.

### 6. Trust (strongly recommended before selling)
- **Windows:** unsigned apps show "Windows protected your PC". A code-signing certificate removes it.
- **Mac:** unsigned apps are blocked by Gatekeeper. You need an Apple Developer account (US$99/year) to sign and
  notarize, otherwise customers must right-click → Open.
- Put the download on a simple website with the price, what's included, a refund policy, a privacy policy,
  and your support email.

---

## Good to know

- **No protection is unbreakable.** The app runs on the customer's computer, so a determined person can
  eventually alter it. This setup stops casual copying: the trial can't export, and keys can't be forged or
  edited. It doesn't stop someone sharing a real key with friends.
- **Online activation (on when `licenseServer` is set):** each key works on up to `MAX_DEVICES` computers (default 3).
  Activating a 4th shows the customer their computers with a **Remove** button. The app re-checks with your server
  every 12 hours and works offline for up to `TOKEN_DAYS` (30) days between check-ins.
- **Refunds / cancelling:** `node tools/admin.js revoke buyer@email.com`. The app drops back to the trial the next
  time it goes online (or at worst when its 30-day token runs out). A Paystack refund event does this automatically.
  Other commands: `list`, `restore`, `reset` (free all computers), `limit <n>`. Set `SERVER` and `ADMIN_TOKEN` first.
- **Server disk:** the server stores licenses in `data.json` under `DATA_DIR`. Use a persistent disk and back it up.
  If it is wiped, customers' tokens keep working until they expire, then re-activate by themselves with their key.
- **Limits:** a cancelled license can't be cut off instantly on a computer that stays offline; it ends at token expiry.
  A determined person can still modify the app; this deters sharing, it isn't unbreakable.
- **Updates:** a key keeps working for all `1.x` versions you release. For a paid `2.0`, issue new keys.
- Keep each customer's email and order reference (Paystack records them; the server logs them too).
