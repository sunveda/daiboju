// Where the Daiboju API lives. Empty = same origin (the Vercel deployment).
// The copy hosted at https://sunveda.tech/app/daiboju/ sets this to the Vercel URL.
window.DAIBOJU_API = window.DAIBOJU_API || '';
// Launch gate for real sign-ups. The sunveda.tech copy keeps this false until its privacy policy covers Daiboju.
if (window.DAIBOJU_SIGNUP_OPEN === undefined) window.DAIBOJU_SIGNUP_OPEN = true;
