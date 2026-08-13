import { useEffect, useState } from "react";
import { ArtworkRecord, gradientFor, listGalleryArtworks } from "@/lib/db";

export type GalleryArtwork = {
  id: string;
  title: string;
  artist: string;
  status: "negotiation" | "sold";
  price: number | null;
  gradient: string;
  description: string | null;
  image_url: string | null;
};

function mapRecord(record: ArtworkRecord): GalleryArtwork {
  return {
    id: record.id,
    title: record.title,
    artist: record.artist_name ?? "Artiste",
    status: record.status,
    price: record.price,
    gradient: record.gradient || gradientFor(record.title),
    description: record.description,
    image_url: record.image_url,
  };
}

export function useArtworks(): { artworks: GalleryArtwork[]; loading: boolean } {
  const [artworks, setArtworks] = useState<GalleryArtwork[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listGalleryArtworks()
      .then((rows) => {
        if (active) setArtworks(rows.map(mapRecord));
      })
      .catch(() => {
        if (active) setArtworks([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { artworks, loading };
}
