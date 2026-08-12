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

const FALLBACK_ARTWORKS: GalleryArtwork[] = [
  { id: "f1", title: "Coucher de soleil", artist: "Artiste Démo", status: "negotiation", price: null, gradient: "from-[#132853] via-[#1E3A6E] to-[#C9A84C]", description: "Huile sur toile, 60x80cm", image_url: null },
  { id: "f2", title: "Abstraction marine", artist: "Camille R.", status: "negotiation", price: 1200, gradient: "from-[#1E3A6E] via-[#132853] to-[#477E70]", description: "Acrylique, 80×80", image_url: null },
  { id: "f3", title: "Lumière dorée", artist: "Julien M.", status: "negotiation", price: 850, gradient: "from-[#C9A84C] via-[#132853] to-[#0E1E3D]", description: "Huile, 60×80", image_url: null },
  { id: "f4", title: "Portrait bleu et or", artist: "Aïcha B.", status: "sold", price: null, gradient: "from-[#477E70] via-[#132853] to-[#C9A84C]", description: "Mixte, 50×70", image_url: null },
  { id: "f5", title: "Nuit étoilée urbaine", artist: "Lucas D.", status: "negotiation", price: 980, gradient: "from-[#0E1E3D] via-[#1E3A6E] to-[#6B6B70]", description: "Huile, 70×90", image_url: null },
  { id: "f6", title: "Jardin méditerranéen", artist: "Inès T.", status: "negotiation", price: 640, gradient: "from-[#C9A84C] via-[#477E70] to-[#132853]", description: "Aquarelle, 40×50", image_url: null },
];

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
  const [artworks, setArtworks] = useState<GalleryArtwork[]>(FALLBACK_ARTWORKS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listGalleryArtworks()
      .then((rows) => {
        if (!active) return;
        if (rows.length > 0) {
          setArtworks(rows.map(mapRecord));
        } else {
          setArtworks(FALLBACK_ARTWORKS);
        }
      })
      .catch(() => {
        if (active) setArtworks(FALLBACK_ARTWORKS);
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
