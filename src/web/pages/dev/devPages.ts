import { lazy } from 'react';

// Use paths relative to /dev for the child routes and their links.
export const devPages = [
  {
    path: 'components',
    title: 'Components',
    desc: 'UI component showcase.',
    Component: lazy(() => import('./DevShowcase').then((m) => ({ default: m.DevShowcase }))),
  },
  {
    path: 'tenants',
    title: 'Tenants',
    desc: 'List and create tenants.',
    Component: lazy(() => import('./DevTenants').then((m) => ({ default: m.DevTenants }))),
  },
  {
    path: 'users',
    title: 'Users',
    desc: 'List users per tenant.',
    Component: lazy(() => import('./DevUsers').then((m) => ({ default: m.DevUsers }))),
  },
  {
    path: 'webauthn',
    title: 'Passkey test',
    desc: 'Register and sign in with a passkey.',
    Component: lazy(() => import('./DevWebAuthn').then((m) => ({ default: m.DevWebAuthn }))),
  },
  {
    path: 'email',
    title: 'Email test',
    desc: 'Send a test email.',
    Component: lazy(() => import('./DevEmail').then((m) => ({ default: m.DevEmail }))),
  },
  {
    path: 'token',
    title: 'Token',
    desc: 'Issue and verify a user access token (JWT).',
    Component: lazy(() => import('./DevToken').then((m) => ({ default: m.DevToken }))),
  },
];
