import { useClerk } from '@clerk/clerk-react'

const REQUEST_EMAIL = 'support@niksprojects.com'
const PREVIEW_COUNT = 5

export { PREVIEW_COUNT }

export default function AccessGate() {
  const { openSignIn } = useClerk()

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
          Sign in with your portal account to unlock the full job board.
        </p>

        <button className="gate-btn-unlock" onClick={() => openSignIn()}>
          Sign In to Unlock
        </button>

        <div className="gate-divider">or</div>

        <a className="gate-btn-request" href={mailtoLink}>
          Request Access
        </a>
        <p className="gate-hint">
          Not a client yet? Click above to send a request and Nik will get back to you.
        </p>
      </div>
    </div>
  )
}
