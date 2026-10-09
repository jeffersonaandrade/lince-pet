import { NextResponse } from 'next/server'
import { route } from '@/server/http'
import { createState, googleAuthorizeUrl, setStateCookie } from '@/server/auth/google'

export const GET = route(async (req) => {
  const state = createState()
  const res = NextResponse.redirect(googleAuthorizeUrl(req.nextUrl.origin, state), 302)
  setStateCookie(res, state)
  return res
})
