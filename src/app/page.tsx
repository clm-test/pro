import { Metadata } from "next";
import App from "~/app/app";

const appUrl = process.env.NEXT_PUBLIC_URL;

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const frame = {
    version: "next",
    imageUrl: `${appUrl}/og.png`,
    button: {
      title: "subscribe for Farcaster Pro",
      action: {
        type: "launch_frame",
        name: "Pro",
        url: `${appUrl}`,
        splashImageUrl: `${appUrl}/logo.png`,
        splashBackgroundColor: "#8660cc",
      },
    },
  };

  return {
    title: "Farcaster Pro",
    openGraph: {
      title: "Farcaster Pro",
      description: "A mini app to subscribe to Farcaster Pro",
    },
    other: {
      "fc:frame": JSON.stringify(frame),
    },
  };
}

export default function Home() {
  return <App />;
}
