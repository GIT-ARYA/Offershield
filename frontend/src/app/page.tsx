
"use client";

import { useEffect, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

type Theme = "dark" | "light";
type ApiStatus = "checking" | "connected" | "offline";
type ScanFinding = {
  type?: string;
  severity?: string;
  evidence?: string;
  explanation?: string;
};
type ScanPayload = {
  message?: string;
  error?: string;
  scan_id?: string;
  risk_level?: string;
  findings?: ScanFinding[];
  recommendations?: string[];
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

export default function Home() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [offerText, setOfferText] = useState("");
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");
  const [isChecking, setIsChecking] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [scanError, setScanError] = useState(false);
  const [scanResult, setScanResult] = useState<ScanPayload | null>(null);

  const statusText =
    apiStatus === "connected"
      ? "Scanner API connected"
      : apiStatus === "offline"
        ? "Scanner API unavailable"
        : "Checking scanner connection…";

  // Submit the text to the Go/Gin scanner. Never report a successful scan
  // unless the backend returns a successful response.
  async function handleScan() {
    const trimmedText = offerText.trim();

    if (!trimmedText) {
      setScanError(true);
      setScanMessage("Paste a job offer, email, or recruiter message first.");
      return;
    }

    setIsChecking(true);
    setScanMessage("");
    setScanError(false);
    setScanResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/scans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
  content: trimmedText,
  type: "job_offer",
}),
      });

      const responseText = await response.text();
      let payload: ScanPayload = {};

      if (responseText) {
        try {
          payload = JSON.parse(responseText);
        } catch {
          // Non-JSON response; use a readable fallback below.
        }
      }

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            "The Go backend is running, but POST /api/v1/scans is not implemented yet. Add that endpoint before scanning messages."
          );
        }
        throw new Error(
          payload.error || payload.message || `The scan request failed (${response.status}).`
        );
      }

      setScanResult(payload);
      setScanMessage(
        payload.message ||
          "Analysis complete. Review the findings below and verify the opportunity independently."
      );
    } catch (error) {
      setScanError(true);
      setScanMessage(
        error instanceof Error
          ? error.message
          : "Could not connect to the scanner. Check that your Go backend is running."
      );
    } finally {
      setIsChecking(false);
    }
  }

  // Restore the saved theme.
  useEffect(() => {
    const savedTheme = localStorage.getItem("offershield-theme");

    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }
  }, []);

  // Apply and save the selected theme.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("offershield-theme", theme);
  }, [theme]);

  // Check whether the Go backend is running.
  useEffect(() => {
    let active = true;

    async function checkBackend() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/health`);

        if (!response.ok) {
          throw new Error("Backend health check failed");
        }

        if (active) setApiStatus("connected");
      } catch {
        if (active) setApiStatus("offline");
      }
    }

    checkBackend();

    return () => {
      active = false;
    };
  }, []);

  // Scroll-triggered motion. The main page remains vertical; only the feature
  // journey is pinned and translated horizontally on desktop.
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();

    media.add("(min-width: 761px)", () => {
      // Crisp, staggered entrance for the original hero. The shield artwork
      // and its existing float animation are intentionally left untouched.
      const heroItems = gsap.utils.toArray<HTMLElement>(
        ".hero-copy > .eyebrow, .hero-copy > h1, .hero-copy > .hero-description, .hero-copy > .hero-actions, .hero-copy > .trust-points"
      );
      gsap.fromTo(
        heroItems,
        { y: 22, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.72, stagger: 0.11, ease: "back.out(1.25)", clearProps: "transform" }
      );

      gsap.fromTo(
        ".hero-visual .floating-card",
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.65, stagger: 0.16, delay: 0.35, ease: "back.out(1.3)", clearProps: "opacity" }
      );

      const viewport = document.querySelector<HTMLElement>(".feature-journey-viewport");
      const track = document.querySelector<HTMLElement>(".feature-journey-track");
      if (viewport && track && window.matchMedia("(min-width: 761px)").matches) {
        const panels = gsap.utils.toArray<HTMLElement>(".journey-panel");
        const distance = () => {
          const styles = window.getComputedStyle(viewport);
          const horizontalPadding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
          return Math.max(0, track.scrollWidth - (viewport.clientWidth - horizontalPadding));
        };

        const updatePanelFocus = () => {
          const viewportRect = viewport.getBoundingClientRect();
          const centerX = viewportRect.left + viewportRect.width / 2;
          const focusRange = viewportRect.width * 0.46;

          panels.forEach((panel) => {
            const rect = panel.getBoundingClientRect();
            const panelCenter = rect.left + rect.width / 2;
            const normalizedDistance = Math.min(1, Math.abs(panelCenter - centerX) / focusRange);
            // Keep the centred panel perfectly crisp; softly de-emphasize panels
            // that are approaching or leaving the viewport edges.
            const blur = Math.min(3.2, Math.max(0, normalizedDistance - 0.2) * 3.8);
            const opacity = 1 - Math.min(0.22, Math.max(0, normalizedDistance - 0.22) * 0.24);
            panel.style.filter = `blur(${blur.toFixed(2)}px)`;
            panel.style.opacity = opacity.toFixed(3);
          });
        };

        const horizontalTween = gsap.to(track, {
          x: () => -distance(),
          ease: "none",
          onUpdate: updatePanelFocus,
          scrollTrigger: {
            trigger: viewport,
            pin: true,
            scrub: 0.42,
            start: "top top+=82",
            // Shorter scroll distance makes the panels travel more decisively.
            end: () => `+=${Math.max(distance() * 0.62, window.innerWidth * 1.05)}`,
            invalidateOnRefresh: true,
            anticipatePin: 1,
            onRefresh: updatePanelFocus,
          },
        });
        updatePanelFocus();

        panels.forEach((panel, index) => {
          gsap.fromTo(
            panel,
            { y: 24, opacity: 0.72, scale: 0.985 },
            {
              y: 0,
              opacity: 1,
              scale: 1,
              ease: "none",
              scrollTrigger: {
                trigger: panel,
                containerAnimation: horizontalTween,
                start: "left 92%",
                end: "left 52%",
                scrub: 0.45,
                invalidateOnRefresh: true,
              },
            }
          );
        });
      }

      // Keep the rest of the page in the same depth-of-field language as the
      // horizontal journey: content near the viewport centre is crisp, while
      // content approaching the top/bottom edges softly falls out of focus.
      const verticalFocusItems = gsap.utils.toArray<HTMLElement>(
        ".hero-copy, .hero-visual, .checker-section .section-heading, .disclaimer, .how-section .section-heading"
      );
      const updateVerticalFocus = () => {
        const centerY = window.innerHeight * 0.5;
        const focusRange = window.innerHeight * 0.58;
        verticalFocusItems.forEach((element) => {
          // Skip elements controlled by the horizontal pinned animation.
          if (element.closest(".feature-journey-viewport")) return;
          const rect = element.getBoundingClientRect();
          const itemCenter = rect.top + rect.height / 2;
          const normalizedDistance = Math.min(1, Math.abs(itemCenter - centerY) / focusRange);
          const blur = Math.min(2.8, Math.max(0, normalizedDistance - 0.22) * 3.6);
          const opacity = 1 - Math.min(0.18, Math.max(0, normalizedDistance - 0.25) * 0.2);
          element.style.filter = `blur(${blur.toFixed(2)}px)`;
          element.style.opacity = opacity.toFixed(3);
        });
      };
      const verticalFocusTrigger = ScrollTrigger.create({
        start: 0,
        end: "max",
        onUpdate: updateVerticalFocus,
        onRefresh: updateVerticalFocus,
      });
      updateVerticalFocus();

      // Cards elsewhere reveal once as they enter the viewport.
      gsap.utils.toArray<HTMLElement>(".checker-card, .section-heading, .disclaimer, .how-section, .final-cta").forEach((element) => {
        gsap.fromTo(
          element,
          { y: 22, opacity: 0.65 },
          {
            y: 0,
            opacity: 1,
            duration: 0.65,
            ease: "power2.out",
            scrollTrigger: {
              trigger: element,
              start: "top 88%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });
    });

    // Narrow screens use a natural vertical journey, with no pinning.
    media.add("(max-width: 760px) and (prefers-reduced-motion: no-preference)", () => {
      gsap.utils.toArray<HTMLElement>(".journey-panel, .step-card").forEach((element, index) => {
        gsap.fromTo(
          element,
          { y: 18, opacity: 0.7 },
          {
            y: 0,
            opacity: 1,
            duration: 0.55,
            delay: (index % 2) * 0.04,
            ease: "power2.out",
            scrollTrigger: {
              trigger: element,
              start: "top 92%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });
    });

    return () => media.revert();
  }, []);

  return (
    <main className={`site theme-${theme}`}>
      {/* Fixed background; the content scrolls over it. */}
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <div className="ambient ambient-three" aria-hidden="true" />

      <header className="topbar page-width">
        <a className="brand" href="#home" aria-label="OfferShield home">
          <span className="brand-icon">
            <svg
              viewBox="0 0 40 40"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M20 3.5 33 8.5V18c0 8.2-5.2 14.5-13 18.5C12.2 32.5 7 26.2 7 18V8.5L20 3.5Z"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="m13.5 20 4.2 4.2 9-9"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>

          <span className="brand-name">
            Offer<span>Shield</span>
          </span>
        </a>

        <nav className="nav-links" aria-label="Main navigation">
          <a className="nav-link active" href="#home">
            Home
          </a>
          <a className="nav-link" href="#how-it-works">
            How it works
          </a>
          <a className="nav-link" href="#features">
            Features
          </a>
        </nav>

        <div className="header-actions">
          <button
            className="theme-toggle glass"
            type="button"
            onClick={() =>
              setTheme((current) =>
                current === "dark" ? "light" : "dark"
              )
            }
            aria-label={`Switch to ${
              theme === "dark" ? "light" : "dark"
            } mode`}
            title="Toggle appearance"
          >
            {theme === "dark" ? (
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle
                  cx="12"
                  cy="12"
                  r="4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>

          <a className="button button-small button-primary" href="#checker">
            Check an offer <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>

      <div className="page-width page-content">
        {/* Hero */}
        <section className="hero" id="home">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              YOUR CAREER. YOUR SECURITY.
            </div>

            <h1>
              That dream job.
              <br />
              <span className="gradient-text">Is it for real?</span>
            </h1>

            <p className="hero-description">
              Fake job offers. Phishing emails. Fraudulent recruiters.
              Before you trust the opportunity, make sure it deserves
              your trust.
            </p>

            <div className="hero-actions">
              <a className="button button-primary" href="#checker">
                <span>Verify an offer</span>
                <span aria-hidden="true">↗</span>
              </a>

              <a className="button button-secondary" href="#how-it-works">
                See how it works
                <span aria-hidden="true">↓</span>
              </a>
            </div>

            <div className="trust-points">
              <span>
                <span className="check-icon">✓</span> Job offer checks
              </span>
              <span>
                <span className="check-icon">✓</span> Phishing awareness
              </span>
              <span>
                <span className="check-icon">✓</span> Recruiter red flags
              </span>
            </div>
          </div>

          {/* Decorative security panel */}
          <div className="hero-visual">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />

            <div className="security-glass glass">
              <div className="security-top">
                <span className="security-label">OFFERSHIELD SECURITY</span>
                <span className="live-indicator">
                  <span /> LIVE
                </span>
              </div>

              <div className="shield-art">
                <div className="shield-glow" />
                <svg
                  viewBox="0 0 150 170"
                  fill="none"
                  aria-label="Shield illustration"
                  role="img"
                >
                  <path
                    d="M75 9 129 29v43c0 36-21 63-54 84C42 135 21 108 21 72V29L75 9Z"
                    fill="url(#shieldFill)"
                    fillOpacity=".16"
                    stroke="url(#shieldStroke)"
                    strokeWidth="2.4"
                  />
                  <path
                    d="M75 23 116 38v34c0 28-16 49-41 66C50 121 34 100 34 72V38l41-15Z"
                    stroke="url(#shieldStroke)"
                    strokeOpacity=".5"
                    strokeWidth="1.2"
                  />
                  <path
                    d="m53 78 15 15 30-32"
                    stroke="#70E7C1"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <defs>
                    <linearGradient
                      id="shieldFill"
                      x1="21"
                      y1="9"
                      x2="129"
                      y2="156"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop stopColor="#6A8BFF" />
                      <stop offset="1" stopColor="#8A5CFF" />
                    </linearGradient>
                    <linearGradient
                      id="shieldStroke"
                      x1="21"
                      y1="9"
                      x2="129"
                      y2="156"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop stopColor="#9AB4FF" />
                      <stop offset="1" stopColor="#B18AFF" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              <div className="security-caption">
                <span className="security-caption-icon">✦</span>
                <div>
                  <strong>Your next opportunity, protected.</strong>
                  <p>Think before you trust.</p>
                </div>
              </div>

              <div className="security-footer">
                <span>THREAT AWARENESS</span>
                <span className="security-footer-value">ALWAYS ON</span>
              </div>
            </div>

            <div className="floating-card floating-card-top glass">
              <span className="floating-icon icon-green">✓</span>
              <div>
                <strong>Stay one step ahead</strong>
                <span>Spot suspicious signals</span>
              </div>
            </div>

            <div className="floating-card floating-card-bottom glass">
              <span className="floating-icon icon-purple">⌕</span>
              <div>
                <strong>Look beyond the logo</strong>
                <span>Verify before you trust</span>
              </div>
            </div>

            <div className="visual-caption">
              <span className="visual-caption-dot" />
              Your digital career bodyguard
            </div>
          </div>
        </section>

        {/* Quick feature strip */}
        <section className="feature-strip" id="features">
          <div className="feature-strip-item">
            <span className="feature-symbol symbol-blue">⌕</span>
            <div>
              <strong>Suspicious messages</strong>
              <span>Find warning signs in text</span>
            </div>
          </div>

          <div className="feature-divider" />

          <div className="feature-strip-item">
            <span className="feature-symbol symbol-purple">◎</span>
            <div>
              <strong>Offer verification</strong>
              <span>Question unusual requests</span>
            </div>
          </div>

          <div className="feature-divider" />

          <div className="feature-strip-item">
            <span className="feature-symbol symbol-green">◇</span>
            <div>
              <strong>Safer decisions</strong>
              <span>Know what to investigate</span>
            </div>
          </div>
        </section>

        {/* Pinned feature journey: only this section moves horizontally on desktop. */}
        <section className="feature-journey-section" aria-labelledby="journey-title">
          <div className="journey-intro">
            <div>
              <div className="eyebrow"><span className="eyebrow-dot" /> A CLOSER LOOK</div>
              <h2 id="journey-title">Small signals.<br /><span className="gradient-text">Big decisions.</span></h2>
            </div>
            <p>Explore the warning signs, understand what they mean, and learn how to verify an opportunity before you commit.</p>
          </div>

          <div className="feature-journey-viewport">
            <div className="feature-journey-track">
              <article className="journey-panel journey-panel-blue glass">
                <div className="journey-panel-top"><span className="journey-icon journey-icon-blue">⌕</span><span className="journey-step">01 / SPOT</span></div>
                <h3>Spot suspicious signals</h3>
                <p>Scams often rely on urgency, exciting promises, and requests that feel just a little out of place.</p>
                <ul><li>Unrealistic pay for very little work</li><li>Upfront fees for training or equipment</li><li>Pressure to act immediately</li><li>Links or attachments you did not expect</li></ul>
                <div className="journey-note"><span>✦</span> Pause when a message pushes you to rush.</div>
              </article>

              <article className="journey-panel journey-panel-purple glass">
                <div className="journey-panel-top"><span className="journey-icon journey-icon-purple">◎</span><span className="journey-step">02 / EXAMINE</span></div>
                <h3>Look beyond the logo</h3>
                <p>A familiar company name or polished offer letter is not proof that the sender represents that company.</p>
                <ul><li>Check the full sender email address</li><li>Compare the domain with the official website</li><li>Look for inconsistent names or contact details</li><li>Question unusual grammar and formatting</li></ul>
                <div className="journey-note"><span>✦</span> Verify the sender, not just the branding.</div>
              </article>

              <article className="journey-panel journey-panel-green glass">
                <div className="journey-panel-top"><span className="journey-icon journey-icon-green">⌁</span><span className="journey-step">03 / UNDERSTAND</span></div>
                <h3>Understand the risk</h3>
                <p>One unusual detail does not prove fraud. Several warning signs together deserve a closer look.</p>
                <ul><li>Separate observable clues from assumptions</li><li>Consider the context of each request</li><li>Do not treat a score as a guarantee</li><li>Keep uncertainty in the decision</li></ul>
                <div className="journey-note"><span>✦</span> Evidence beats a simple red-or-green label.</div>
              </article>

              <article className="journey-panel journey-panel-pink glass">
                <div className="journey-panel-top"><span className="journey-icon journey-icon-pink">↗</span><span className="journey-step">04 / ACT</span></div>
                <h3>Choose your next step</h3>
                <p>When something feels off, take a moment to confirm the opportunity through a separate, trusted route.</p>
                <ul><li>Contact the company using its official site</li><li>Never pay to secure a job offer</li><li>Do not share passwords or one-time codes</li><li>Report suspicious messages where appropriate</li></ul>
                <div className="journey-note"><span>✦</span> Verify independently before you reply.</div>
              </article>
            </div>
          </div>
          <div className="journey-scroll-hint"><span className="journey-hint-line" /> Scroll to explore <span aria-hidden="true">→</span></div>
        </section>

        {/* Offer checker */}
        <section className="checker-section" id="checker">
          <div className="section-heading reveal">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              THE FIRST LINE OF DEFENCE
            </div>

            <h2>
              Before you say yes,
              <br />
              <span className="gradient-text">check the details.</span>
            </h2>

            <p>
              Paste the suspicious message below to start your security
              review.
            </p>
          </div>

          <div className="checker-card glass reveal">
            <div className="checker-header">
              <div className="checker-title-group">
                <div className="checker-icon">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M7 3.5h7l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V5a1.5 1.5 0 0 1 1.5-1.5Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M14 3.5V9h5M8.5 13h7m-7 4h7"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <div>
                  <h3>Offer & message checker</h3>
                  <p>Review a job offer, email or recruiter message.</p>
                </div>
              </div>

              <span className="private-label">
                <span>◇</span> Text input
              </span>
            </div>

            <label className="textarea-label" htmlFor="offer-text">
              YOUR MESSAGE
            </label>

            <textarea
              id="offer-text"
              className="offer-textarea"
              placeholder={`Paste the job offer or suspicious message here...\n\nExample: Congratulations! You have been selected for a remote job. Pay a refundable registration fee to receive your offer letter.`}
              value={offerText}
              maxLength={10000}
              onChange={(event) => {
                setOfferText(event.target.value);
                setScanMessage("");
                setScanError(false);
                setScanResult(null);
              }}
            />

            <div className="textarea-bottom">
              <span className="input-hint">
                <span className="hint-dot" />
                Never include passwords or sensitive personal information.
              </span>
              <span className="character-count">
                {offerText.length.toLocaleString()} / 10,000
              </span>
            </div>

            <button
              className="button button-primary scan-button"
              type="button"
              onClick={handleScan}
              disabled={isChecking}
            >
              {isChecking ? (
                <>
                  <span className="spinner" />
                  Connecting to scanner...
                </>
              ) : (
                <>
                  Analyze this message
                  <span aria-hidden="true">↗</span>
                </>
              )}
            </button>

            {scanMessage && (
              <div
                className={`scan-message ${
                  scanError ? "scan-message-error" : "scan-message-success"
                }`}
                role="status"
                aria-live="polite"
              >
                <span>{scanError ? "!" : "✓"}</span>
                <p>{scanMessage}</p>
              </div>
            )}

            {scanResult && (
              <section className="scan-results" aria-labelledby="scan-results-title" aria-live="polite">
                <div className="results-heading">
                  <div>
                    <span className="results-eyebrow">SCAN COMPLETE</span>
                    <h3 id="scan-results-title">Your analysis</h3>
                    <p>Rule-based signals found in the message you submitted.</p>
                  </div>
                  <span className={`risk-pill risk-${(scanResult.risk_level || "unknown").toLowerCase()}`}>
                    <span className="risk-pulse" />
                    {(scanResult.risk_level || "Unknown risk").replace(/_/g, " ")} risk
                  </span>
                </div>

                {scanResult.scan_id && (
                  <p className="scan-id">Scan reference: <code>{scanResult.scan_id}</code></p>
                )}

                <div className="results-section-title">
                  <h4>Detected warning signs</h4>
                  <span>{scanResult.findings?.length ?? 0} found</span>
                </div>

                {scanResult.findings && scanResult.findings.length > 0 ? (
                  <div className="finding-list">
                    {scanResult.findings.map((finding, index) => (
                      <article className="finding-card" key={`${finding.type || "finding"}-${index}`}>
                        <div className="finding-topline">
                          <span className="finding-number">{String(index + 1).padStart(2, "0")}</span>
                          <h5>{(finding.type || "Warning sign").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}</h5>
                          <span className={`severity-pill severity-${(finding.severity || "medium").toLowerCase()}`}>
                            {finding.severity || "Review"}
                          </span>
                        </div>
                        {finding.evidence && <blockquote className="finding-evidence">“{finding.evidence}”</blockquote>}
                        {finding.explanation && <p className="finding-explanation">{finding.explanation}</p>}
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="no-findings">
                    <span>✓</span>
                    <p>No warning signs were flagged by the current rules. This does not guarantee the message is legitimate.</p>
                  </div>
                )}

                {scanResult.recommendations && scanResult.recommendations.length > 0 && (
                  <div className="recommendations-panel">
                    <div className="results-section-title">
                      <h4>Recommended next steps</h4>
                      <span>STAY SAFE</span>
                    </div>
                    <ul>
                      {scanResult.recommendations.map((recommendation, index) => (
                        <li key={`${index}-${recommendation}`}><span>✓</span>{recommendation}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="results-disclaimer">This is a preliminary rule-based assessment, not a definitive scam determination. Confirm the employer and contact details independently.</p>
              </section>
            )}

            <div className="checker-status">
              <span
                className={`status-dot status-${apiStatus}`}
              />
              <span>{statusText}</span>
              <span className="status-separator">·</span>
              <span>Analysis results depend on the implemented scanner</span>
            </div>
          </div>

          <p className="disclaimer reveal">
            OfferShield is a decision-support tool, not a guarantee that a
            message is genuine or fraudulent. Verify employers through
            independently obtained official contact details.
          </p>
        </section>

        {/* How it works */}
        <section className="how-section" id="how-it-works">
          <div className="how-heading">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-dot" />
                SIMPLE. SMARTER. SAFER.
              </div>

              <h2>
                Three steps.
                <br />
                <span className="gradient-text">More confidence.</span>
              </h2>
            </div>

            <p>
              A little caution today can save you from a costly mistake
              tomorrow.
            </p>
          </div>

          <div className="steps-grid">
            <article className="step-card">
              <div className="step-number">01</div>
              <div className="step-icon step-icon-blue">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M7 3.5h7l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V5a1.5 1.5 0 0 1 1.5-1.5Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M14 3.5V9h5M8.5 13h7m-7 4h7"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <h3>01. Bring the message</h3>
              <p>
                Copy the suspicious job offer, email or recruiter message
                you want to investigate.
              </p>
            </article>

            <article className="step-card">
              <div className="step-number">02</div>
              <div className="step-icon step-icon-purple">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle
                    cx="10.8"
                    cy="10.8"
                    r="6.8"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                  <path
                    d="m16 16 4.5 4.5M8 10.8h5.6M10.8 8v5.6"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <h3>02. Examine the signals</h3>
              <p>
                The planned scanner can examine suspicious wording, payment
                requests and other potential warning signs.
              </p>
            </article>

            <article className="step-card">
              <div className="step-number">03</div>
              <div className="step-icon step-icon-green">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="m5 12.5 4.5 4.5L19.5 7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3>03. Make an informed choice</h3>
              <p>
                Use the findings as a starting point, then independently
                verify the employer before taking action.
              </p>
            </article>
          </div>
        </section>

        {/* Final CTA */}
        <section className="final-cta glass">
          <div className="cta-orb" aria-hidden="true" />
          <div className="final-cta-content">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              YOUR NEXT MOVE MATTERS
            </div>
            <h2>
              Trust your ambition.
              <br />
              <span className="gradient-text">Verify the opportunity.</span>
            </h2>
            <p>
              Your dream career should not come at the cost of your
              security.
            </p>
            <a className="button button-primary" href="#checker">
              Check a message <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>

        <footer className="footer">
          <a className="brand footer-brand" href="#home">
            <span className="brand-icon">
              <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <path
                  d="M20 3.5 33 8.5V18c0 8.2-5.2 14.5-13 18.5C12.2 32.5 7 26.2 7 18V8.5L20 3.5Z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="m13.5 20 4.2 4.2 9-9"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="brand-name">
              Offer<span>Shield</span>
            </span>
          </a>

          <p>Built to help you spot suspicious job opportunities.</p>

          <a href="#home" className="back-to-top">
            Back to top ↑
          </a>
        </footer>
      </div>
    </main>
  );
}
