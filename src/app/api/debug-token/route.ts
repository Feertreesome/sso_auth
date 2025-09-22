import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function GET(req: Request) {
    const secret = process.env.NEXTAUTH_SECRET;
    const decoded = await getToken({ req, secret });
    console.log(decoded, 'decoded')// объект payload
    const raw = await getToken({ req, raw: true });    // сырая строка JWT
    console.log(raw, 'raw')
    if (!decoded || !raw) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ decoded, raw });
}
