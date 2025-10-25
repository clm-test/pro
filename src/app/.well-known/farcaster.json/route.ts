export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_URL;

  const config = {
    accountAssociation: {
      header:
        "eyJmaWQiOjI2ODQzOCwidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweDIxODA4RUUzMjBlREY2NGMwMTlBNmJiMEY3RTRiRkIzZDYyRjA2RWMifQ",
      payload: "eyJkb21haW4iOiJwcm8uaXRzY2FzaGxlc3MuY29tIn0",
      signature:
        "MHg3NDA1ZDhkMTdlNjYyMzM3NjFkMWUxNmZjYWFjZWYxMDg4ODBiZDg3NzNkN2EzNDNiM2M1ZTZhZWQ1YzczZTA2MDNjYTJkZjMwYjcyNTJkYWUzMGQwZTcyOTA1NTM4YmQxNzI2Zjg0OWRlZTNhMDEwZWYxZmYzZDg4MzlmZGU1ODFj",
    },
    frame: {
      version: "1",
      name: "Farcaster Pro",
      iconUrl: `${appUrl}/logo.png`,
      homeUrl: appUrl,
      imageUrl: `${appUrl}/og.png`,
      buttonTitle: "subscribe",
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
      ogDescription: "Subscribe to Farcaster Pro for exclusive features.",
      requiredChains: ["eip155:8453"],
      canonicalDomain: "pro.itscashless.com",

      baseBuilder: {
        allowedAddresses: ["0x06e5B0fd556e8dF43BC45f8343945Fb12C6C3E90"],
      },
    },
  };

  return Response.json(config);
}
