export function renderSignupUrlWithUtms(content = "footer_link"): string {
  const params = new URLSearchParams({
    utm_source: "github",
    utm_medium: "referral",
    utm_campaign: "ojus_demos",
    utm_content: content,
  });
  return `https://dashboard.render.com/register?${params.toString()}`;
}

export const GITHUB_REPO_URL =
  "https://github.com/ojusave/ragtime";

export const DEPLOY_TO_RENDER_URL =
  "https://render.com/deploy?repo=https://github.com/ojusave/ragtime";
