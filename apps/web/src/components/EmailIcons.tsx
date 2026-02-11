// Gmail and Outlook SVG logos for email import modal

export const GmailLogo = ({ className = '' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    width="24"
    height="24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M22 4H2C.9 4 0 4.9 0 6v12c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"
      fill="#f2f2f2"
    />
    <path d="M12 13.5L2 6.5v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-11L12 13.5z" fill="#d9d9d9" />
    <path
      d="M12 12.5l10-6.5c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2l10 6.5z"
      fill="#ea4335"
    />
    <path d="M2 6l10 6.5L22 6v.5l-10 6.5L2 6.5V6z" fill="#c5221f" />
    <path d="M2 6.5l10 6.5 10-6.5v11c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2v-11z" fill="none" />
  </svg>
)

export const OutlookLogo = ({ className = '' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    width="24"
    height="24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M21.17 3.25Q21.5 3.25 21.76 3.5 22 3.74 22 4.08V19.92Q22 20.26 21.76 20.5 21.5 20.75 21.17 20.75H7.83Q7.5 20.75 7.24 20.5 7 20.26 7 19.92V17H2.83Q2.5 17 2.24 16.76 2 16.5 2 16.17V7.83Q2 7.5 2.24 7.24 2.5 7 2.83 7H7V4.08Q7 3.74 7.24 3.5 7.5 3.25 7.83 3.25M7 13.06L8.18 15.28H9.97L8 12.06L9.93 8.89H8.22L7.13 10.9L7.09 10.96L7.06 10.9L5.96 8.89H4.26L6.18 12.06L4.2 15.28H5.97M13.88 19.5V17H8.25V19.5M13.88 15.75V12.63H12V15.75M13.88 11.38V8.25H12V11.38M13.88 7V4.5H8.25V7M20.75 19.5V17H15.13V19.5M20.75 15.75V12.63H15.13V15.75M20.75 11.38V8.25H15.13V11.38M20.75 7V4.5H15.13V7Z"
      fill="#0078d4"
    />
  </svg>
)
