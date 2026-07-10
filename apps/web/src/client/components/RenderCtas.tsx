import { Button, Group } from "@mantine/core";
import { DEPLOY_TO_RENDER_URL, renderSignupUrlWithUtms } from "../lib/render-links";

type Props = {
  signupContent?: "navbar_button" | "hero_cta" | "footer_link";
  size?: "compact-sm" | "sm" | "md";
};

/** Single placement for Deploy + Sign up on Render links. */
export default function RenderCtas({ signupContent = "navbar_button", size = "compact-sm" }: Props) {
  return (
    <Group gap="xs" wrap="nowrap" className="render-ctas">
      <Button
        className="render-deploy"
        component="a"
        href={DEPLOY_TO_RENDER_URL}
        target="_blank"
        rel="noreferrer"
        variant="filled"
        size={size}
      >
        Deploy to Render
      </Button>
      <Button
        className="render-signup"
        component="a"
        href={renderSignupUrlWithUtms(signupContent)}
        target="_blank"
        rel="noreferrer"
        variant="outline"
        size={size}
      >
        Sign up on Render
      </Button>
    </Group>
  );
}
