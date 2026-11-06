/**
 * portfolio-matcher.ts — Module 5: Portfolio Matcher.
 *
 * SECTION 4, MODULE 5 RULES:
 * 1. Maintain a library of Farid's portfolio samples, each with title,
 *    niche tags, and a link provided by human only.
 * 2. Suggest exactly ONE best matching sample per draft, with a one-line reason.
 * 3. Farid can change or remove it.
 * 4. Never invent a sample, a link, or a result for a sample.
 */

export interface PortfolioItemInput {
  id: string;
  title: string;
  nicheTags: string[];
  link: string;
  isActive: boolean;
}

export interface PortfolioMatchResult {
  matchedItem: PortfolioItemInput | null;
  matchReason: string;
}

/**
 * Match a job's text (title + description + skills) against available portfolio items.
 * Returns the highest scoring matching portfolio item and a plain-language reason.
 *
 * @param jobText - Combined title, description, and skill tags of the job
 * @param portfolioItems - List of active portfolio items
 * @returns PortfolioMatchResult with exactly one best match or null if none available
 */
export function matchPortfolioItem(
  jobText: string,
  portfolioItems: PortfolioItemInput[],
): PortfolioMatchResult {
  const activeItems = portfolioItems.filter((item) => item.isActive);

  if (activeItems.length === 0) {
    return {
      matchedItem: null,
      matchReason: 'No active portfolio items registered in library.',
    };
  }

  const textLower = jobText.toLowerCase();

  // Score each portfolio item based on matching niche tags and title words
  let bestItem: PortfolioItemInput | null = null;
  let bestScore = -1;
  let matchedTag = '';

  for (const item of activeItems) {
    let score = 0;
    let foundTag = '';

    for (const tag of item.nicheTags) {
      const tagLower = tag.toLowerCase();
      const tagWords = tagLower.split(/\s+/).filter((w) => w.length > 4);

      if (textLower.includes(tagLower)) {
        score += 20;
        foundTag = tag; // Exact substring match always takes precedence
      } else if (tagWords.some((w) => textLower.includes(w))) {
        score += 10;
        if (!foundTag) foundTag = tag;
      }
    }

    // Secondary boost if title words appear in job description
    const titleWords = item.title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    for (const word of titleWords) {
      if (textLower.includes(word)) {
        score += 2;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
      matchedTag = foundTag;
    }
  }

  // If no specific tag matched, fallback to the first active item
  if (!bestItem || bestScore <= 0) {
    const fallback = activeItems[0];
    return {
      matchedItem: fallback,
      matchReason: `General Amazon design sample suggested: "${fallback.title}"`,
    };
  }

  const reason = matchedTag
    ? `Matches job's requirement for "${matchedTag}"`
    : `Relevant sample for listing and design: "${bestItem.title}"`;

  return {
    matchedItem: bestItem,
    matchReason: reason,
  };
}
