export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_URL;

  const config = {
    accountAssociation: {
      header:
        "eyJmaWQiOjI2ODQzOCwidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweDIxODA4RUUzMjBlREY2NGMwMTlBNmJiMEY3RTRiRkIzZDYyRjA2RWMifQ",
      payload: "eyJkb21haW4iOiJwcm8tZmFyY2FzdGVyLnZlcmNlbC5hcHAifQ",
      signature:
        "MHg4MDY2YWI4MzMwOGUwMTg2ZGEzMjQyMGEzMWJmODI5NmI4MzcyN2ZhODIxY2FjYWViNGE4YmY4YzllNmY2ZjUwNTMwNmZhODJjNmVlZjdlZTVkMjVhMmI2ZDI0NzYwZDllODYxOTI2YTcyN2VkZDU2MTAxY2U2NTBjMzNmYjE3MjFi",
    },
    frame: {
      version: "1",
      name: "Pro",
      iconUrl: `${appUrl}/logo.png`,
      homeUrl: appUrl,
      imageUrl: `${appUrl}/nft?text=LetterBot`,
      buttonTitle: "subscribe for Farcaster Pro",
      splashImageUrl: `${appUrl}/logo.png`,
      splashBackgroundColor: "#8660cc",
      castShareUrl: appUrl,
      baseBuilder: {
        allowedAddresses: ["0x06e5B0fd556e8dF43BC45f8343945Fb12C6C3E90"],
      },
    },
  };

  return Response.json(config);
}
