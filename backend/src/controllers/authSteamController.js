/**
 * authSteamController.js
 *
 * Handles Steam OpenID 2.0 connection flow for existing Lumium accounts.
 * This is an account-linking flow, not a standalone auth provider.
 *
 * Flow:
 *   1. GET /api/auth/steam/login?token=<jwt>
 *      → Redirects to Steam OpenID, embeds JWT as state in return_to URL.
 *
 *   2. Steam → GET /api/auth/steam/callback?state=<jwt>&openid.*=...
 *      → Verifies OpenID assertion, fetches Steam profile, saves to user.
 *      → Redirects to CLIENT_URL?steam=connected  (or ?steam=error&reason=...)
 *
 *   3. POST /api/auth/steam/disconnect   (requires auth)
 *      → Clears steam field from user.
 */

import axios from 'axios';
import jwt   from 'jsonwebtoken';
import {
  updateSteamConnection,
  clearSteamConnection,
} from '../repositories/userRepository.js';

const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login';
const STEAM_ID_RE      = /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/;

// ─── GET /api/auth/steam/login ────────────────────────────────────────────────

export const steamLogin = (req, res) => {
  const { token } = req.query;
  const clientUrl  = process.env.CLIENT_URL || 'http://localhost:5173';

  if (!token) {
    return res.redirect(`${clientUrl}?steam=error&reason=no_token`);
  }

  // Verify the token is valid before starting the OpenID dance
  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.redirect(`${clientUrl}?steam=error&reason=invalid_token`);
  }

  const realm    = process.env.STEAM_REALM      || `http://localhost:${process.env.PORT || 5000}`;
  const base     = process.env.STEAM_RETURN_URL || `${realm}/api/auth/steam/callback`;
  // Encode JWT as `state` in the return_to — Steam preserves query params on callback
  const returnTo = `${base}?state=${encodeURIComponent(token)}`;

  const params = new URLSearchParams({
    'openid.ns':         'http://specs.openid.net/auth/2.0',
    'openid.mode':       'checkid_setup',
    'openid.return_to':  returnTo,
    'openid.realm':      realm,
    'openid.identity':   'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });

  res.redirect(`${STEAM_OPENID_URL}?${params.toString()}`);
};

// ─── GET /api/auth/steam/callback ─────────────────────────────────────────────

export const steamCallback = async (req, res) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  try {
    const { state: token, ...openidQuery } = req.query;

    // ── 1. Validate Lumium JWT ────────────────────────────────────────────
    if (!token) {
      return res.redirect(`${clientUrl}?steam=error&reason=no_token`);
    }

    let userId;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.id;
    } catch {
      return res.redirect(`${clientUrl}?steam=error&reason=invalid_token`);
    }

    // ── 2. Check Steam returned a positive assertion ───────────────────────
    if (openidQuery['openid.mode'] !== 'id_res') {
      // User cancelled or Steam returned an error
      return res.redirect(`${clientUrl}?steam=error&reason=cancelled`);
    }

    // ── 3. Verify assertion with Steam ────────────────────────────────────
    // Build verification params from the full original query (minus `state`)
    const verifyParams = new URLSearchParams(req.query);
    verifyParams.delete('state');
    verifyParams.set('openid.mode', 'check_authentication');

    const verifyRes = await axios.post(
      STEAM_OPENID_URL,
      verifyParams.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 8000,
      }
    );

    if (!String(verifyRes.data).includes('is_valid:true')) {
      return res.redirect(`${clientUrl}?steam=error&reason=invalid_assertion`);
    }

    // ── 4. Extract SteamID64 from claimed_id ─────────────────────────────
    const claimedId = openidQuery['openid.claimed_id'] ?? '';
    const match     = claimedId.match(STEAM_ID_RE);
    if (!match) {
      return res.redirect(`${clientUrl}?steam=error&reason=invalid_steamid`);
    }
    const steamId = match[1];

    // ── 5. Fetch Steam player summary (non-fatal if missing API key) ──────
    let personaName = '';
    let avatarUrl   = '';

    if (process.env.STEAM_API_KEY) {
      try {
        const profileRes = await axios.get(
          'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/',
          {
            params:  { key: process.env.STEAM_API_KEY, steamids: steamId },
            timeout: 6000,
          }
        );
        const player = profileRes.data?.response?.players?.[0];
        if (player) {
          personaName = player.personaname ?? '';
          avatarUrl   = player.avatarfull ?? player.avatarmedium ?? player.avatar ?? '';
        }
      } catch {
        // Profile enrichment failed — proceed with bare steamId
      }
    }

    // ── 6. Persist Steam connection ───────────────────────────────────────
    await updateSteamConnection(userId, {
      steamId,
      personaName,
      avatarUrl,
      connectedAt: new Date(),
    });

    res.redirect(`${clientUrl}?steam=connected`);
  } catch (err) {
    console.error('[steamCallback]', err.message);
    res.redirect(`${clientUrl}?steam=error&reason=server_error`);
  }
};

// ─── POST /api/auth/steam/disconnect ──────────────────────────────────────────

export const steamDisconnect = async (req, res, next) => {
  try {
    await clearSteamConnection(req.user._id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};
