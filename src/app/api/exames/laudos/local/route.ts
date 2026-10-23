import { NextResponse, type NextRequest } from 'next/server'
import { lerLaudoLocal } from '@/server/services/laudos-storage'

/** Download do driver local de laudos (dev/e2e): link HMAC de 60 s. Sem LAUDOS_STORAGE_DIR responde 404. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const pdf = await lerLaudoLocal(q.get('k') || '', Number(q.get('e')), q.get('s') || '')
  if (!pdf) return NextResponse.json({ message: 'Link inválido ou expirado' }, { status: 404 })
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="laudo.pdf"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
