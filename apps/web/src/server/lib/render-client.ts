import { Render } from "@renderinc/sdk";

export function getRenderClient(): Render {
  const baseUrl = process.env.RENDER_API_URL;
  const token = process.env.RENDER_API_KEY;
  if (!token) {
    throw new Error(
      "RENDER_API_KEY is not set. Add a Render API key to the web service to trigger workflows."
    );
  }
  return new Render({ baseUrl, token });
}
