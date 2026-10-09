import { NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { route } from '@/server/http'
import { setAuthCookie } from '@/server/auth/session'
import {
  GOOGLE_STATE_COOKIE,
  callbackError,
  clearStateCookie,
  fetchGoogleUser,
  frontendBaseUrl,
} from '@/server/auth/google'
import { tokenFor } from '@/server/services/auth'

export const GET = route(async (req) => {
  const origin = req.nextUrl.origin
  const frontend = frontendBaseUrl(origin)
  const params = req.nextUrl.searchParams

  const redirect = (url: string) => {
    const res = NextResponse.redirect(url, 302)
    clearStateCookie(res)
    return res
  }

  const error = callbackError(params, req.cookies.get(GOOGLE_STATE_COOKIE)?.value ?? null)
  if (error) return redirect(`${frontend}/login?error=${error}`)

  try {
    const googleUser = await fetchGoogleUser(params.get('code')!, origin)
    const user = await prisma.user.findUnique({ where: { email: googleUser.email } })

    if (user) {
      const res = redirect(`${frontend}/dashboard`)
      setAuthCookie(res, await tokenFor(user))
      return res
    }

    const query = new URLSearchParams({
      email: googleUser.email,
      name: googleUser.name,
      avatar: googleUser.avatarUrl || '',
      provider: 'google',
      provider_id: googleUser.id,
    })
    return redirect(`${frontend}/signup/social?${query.toString()}`)
  } catch (err) {
    console.error('CRITICAL Google Auth Error:', err)
    return redirect(`${frontend}/login?error=auth_error`)
  }
})
