import { PageIntro, PrimaryLink, SecondaryLink } from "../components/simple/PageIntro";

export default function NotFound() {
  return (
    <PageIntro
      eyebrow="Error 404"
      lines={["This shelf is empty"]}
      accent="Let's find you another."
      intro="That page or skill doesn't exist. It may have been renamed or removed."
      actions={
        <>
          <PrimaryLink href="/skills">Browse skills</PrimaryLink>
          <SecondaryLink href="/">Go home</SecondaryLink>
        </>
      }
    />
  );
}
