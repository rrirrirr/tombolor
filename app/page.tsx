import { Metadata } from "next";
import TombolaClient, { ShareableState } from "./tombola-client";

type Props = {
  searchParams: Promise<{ s?: string }>;
};

function decodeState(encoded: string): ShareableState | null {
  try {
    return JSON.parse(atob(encoded)) as ShareableState;
  } catch {
    return null;
  }
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const encoded = params.s;

  let title = "Tombolor | Dra Din Lott";
  const description = "två trummor - ett öde";

  if (encoded) {
    const state = decodeState(encoded);
    if (state?.title) {
      title = `${state.title} | Tombolor`;
    }
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: "https://tombolor.se",
      siteName: "Tombolor",
      images: [
        {
          url: "/opengraph.png",
          width: 1200,
          height: 630,
          alt: "Tombolor - Dra din lott",
        },
      ],
      locale: "sv_SE",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph.png"],
    },
  };
}

export default function Page() {
  return <TombolaClient />;
}
