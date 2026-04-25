import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  noindex?: boolean;
  type?: "website" | "article";
  publishedAt?: string;
}

const SITE_NAME = "Claramente Não Sou um Escritor";
const DEFAULT_DESCRIPTION = "Crônicas, observações e divagações do cotidiano. Textos sobre viagens, lugares e as pequenas coisas que ninguém pediu pra contar.";

function setMeta(name: string, content: string, attr: "name" | "property" = "name") {
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function useSEO({ title, description, image, noindex, type = "website", publishedAt }: SEOProps = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} — ${SITE_NAME}` : SITE_NAME;
    const desc = description || DEFAULT_DESCRIPTION;

    document.title = fullTitle;

    setMeta("description", desc);
    setMeta("robots", noindex ? "noindex, nofollow" : "index, follow");

    setMeta("og:title", fullTitle, "property");
    setMeta("og:description", desc, "property");
    setMeta("og:type", type, "property");
    if (image) setMeta("og:image", image, "property");

    setMeta("twitter:title", fullTitle);
    setMeta("twitter:description", desc);
    if (image) setMeta("twitter:image", image);

    if (publishedAt) {
      setMeta("article:published_time", publishedAt, "property");
    }
  }, [title, description, image, noindex, type, publishedAt]);
}
