import { useState } from 'react'

const REQUEST_EMAIL = 'support@niksprojects.com'
const PREVIEW_COUNT = 5

export { PREVIEW_COUNT }

export default function AccessGate({ onUnlock }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  const handleUnlock = () => {
    if (input.trim().toUpperCase() === import.meta.env.VITE_ACCESS_CODE?.toUpperCase()) {
      localStorage.setItem('jd_access', 'true')
      onUnlock()
    } else {
      setError(true)
      setTimeout(() => setError(false), 2500)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleUnlock()
  }

  const mailtoLink =
    `mailto:${REQUEST_EMAIL}` +
    `?subject=${encodeURIComponent('Job Board Access Request')}` +
    `&body=${encodeURIComponent(
      'Hi Nik,\n\nI would like to request access to the Niks Projects Job Board.\n\nName: \nRole I\'m targeting: \n\nThank you!'
    )}`

  return (
    <div className="gate-wrapper">
      <div className="gate-fade" />
      <div className="gate-box">
        <div className="gate-lock">🔒</div>
        <h3 className="gate-title">Full Access for Mentorship Clients</h3>
        <p className="gate-subtitle">
          You're seeing {PREVIEW_COUNT} of the available listings.<br />
          Enter your access code to unlock the full job board.
        </p>

        <div className="gate-input-row">
          <input
            className={`gate-input ${error ? 'gate-input--error' : ''}`}
            type="text"
            placeholder="Enter access code"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          <button className="gate-btn-unlock" onClick={handleUnlock}>
            Unlock
          </button>
        </div>

        {error && <p className="gate-error">Incorrect code — try again or request access below.</p>}

        <div className="gate-divider">or</div>

        <a className="gate-btn-request" href={mailtoLink}>
          ✉️ Request Access
        </a>
        <p className="gate-hint">
          Not a client yet? Click above to send a request and Nik will get back to you.
        </p>
      </div>
    </div>
  )
}
