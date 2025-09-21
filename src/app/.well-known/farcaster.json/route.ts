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
      name: "Farcaster Pro",
      iconUrl: `${appUrl}/logo.png`,
      homeUrl: appUrl,
      imageUrl: `${appUrl}/og.png`,
      buttonTitle: "subscribe for 30 days",
      splashImageUrl: `${appUrl}/splash.png`,
      splashBackgroundColor: "#8660cc",
      castShareUrl: appUrl,
      webhookUrl: `${appUrl}/api/webhook`,
      subtitle: "Subscribe to Farcaster Pro",
      description:
        "Subscribe to Farcaster Pro for exclusive features and support the development of the Farcaster ecosystem.",
      primaryCategory: "utility",
      ogImageUrl: `${appUrl}/og.png`,
      tags: ["farcaster", "pro", "subscription", "30", "days"],
      heroImageUrl: `${appUrl}/og.png`,
      tagline: "Subscribe to Farcaster Pro",
      ogTitle: "Farcaster Pro",
      ogDescription:
        "Subscribe to Farcaster Pro for exclusive features and support the development of the Farcaster ecosystem.",
      requiredChains: ["eip155:8453"],
      baseBuilder: {
        allowedAddresses: ["0x06e5B0fd556e8dF43BC45f8343945Fb12C6C3E90"],
      },
    },
  };

  return Response.json(config);
}
