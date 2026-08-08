import { useEffect, useRef, useState } from 'react';

export default function GoogleSignInButton({ onCredential }) {
  const divRef = useRef(null);
  const callbackRef = useRef(onCredential);
  const [rendered, setRendered] = useState(false);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  callbackRef.current = onCredential;

  useEffect(() => {
    if (!clientId || !divRef.current) return undefined;
    let attempts = 0;
    let cancelled = false;
    const renderGoogleButton = () => {
      if (cancelled) return;
      if (!window.google?.accounts?.id) {
        attempts += 1;
        if (attempts < 50) window.setTimeout(renderGoogleButton, 100);
        return;
      }
      // Measuring on the same tick the GSI script becomes ready can catch
      // the container before layout has settled to its final size, which
      // bakes in a narrower width the button can never grow out of later
      // (it's a foreign iframe - our CSS can't resize it after the fact).
      // Wait a frame, then clamp to Google's supported 200-400px range.
      requestAnimationFrame(() => {
        if (cancelled || !divRef.current) return;
        const measured = Math.floor(divRef.current.getBoundingClientRect().width);
        const width = Math.min(400, Math.max(200, measured || 350));
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => callbackRef.current(response.credential),
        });
        window.google.accounts.id.renderButton(divRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          text: 'continue_with',
          logo_alignment: 'left',
          width,
        });
        setRendered(true);
      });
    };
    renderGoogleButton();
    return () => { cancelled = true; attempts = 50; };
  }, [clientId]);

  if (!clientId) {
    return <button className="google-fallback" type="button" disabled title="Add VITE_GOOGLE_CLIENT_ID to enable Google sign-in"><span className="google-g">G</span>Continue with Google</button>;
  }

  return <div className="google-button-wrap">
    {!rendered && <div className="google-loading"><span className="google-g">G</span>Continue with Google</div>}
    <div ref={divRef} style={{ visibility: rendered ? 'visible' : 'hidden', width: '100%', display: 'flex', justifyContent: 'center' }} />
  </div>;
}