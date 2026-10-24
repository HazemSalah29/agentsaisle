export function ContactForm() {
  return (
    <form className="mt-8 max-w-md">
      <label htmlFor="name">Full name</label>
      <input id="name" placeholder="Your name" className="mb-4 w-full rounded-r-md border px-3 text-left" />
      <label htmlFor="email">Email address</label>
      <input id="email" type="email" dir="ltr" placeholder="you@example.com" className="w-full border px-3" />
      <img src="/hero.jpg" alt="Customer smiling at checkout" className="mt-4" />
      <button type="submit" title="Send your message" className="mt-4 mr-2 rounded bg-black px-4 text-white">
        Send message
      </button>
    </form>
  );
}
