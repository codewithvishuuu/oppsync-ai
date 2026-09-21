export const metadata = {
  title: "OppSync AI",
  description: "Discover opportunities. Never miss a deadline.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
