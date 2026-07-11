import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Package, Shield, Zap, Users } from "lucide-react";

const FEATURES = [
  {
    icon: Zap,
    title: "Fast Matching",
    description:
      "Your request is matched with the nearest qualified errander within seconds.",
  },
  {
    icon: Shield,
    title: "Escrow Protected",
    description:
      "Funds are held securely until delivery is confirmed. Both parties protected.",
  },
  {
    icon: Users,
    title: "Verified Erranders",
    description:
      "Every errander goes through KYC verification and earns a public trust score.",
  },
  {
    icon: Package,
    title: "Real-time Tracking",
    description:
      "Track your delivery in real-time with SLA timers and live chat.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Package className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">Errand Boy</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button>
                Get Started
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="py-20 lg:py-32 bg-gradient-to-b from-blue-50/50 to-transparent">
          <div className="max-w-7xl mx-auto px-4 lg:px-8 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
              Get Errands Done.
              <br />
              <span className="text-primary">Fast &amp; Secure.</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-2xl mx-auto">
              Nigeria&apos;s most trusted on-demand errand platform. Post a
              request and a verified errander handles it — with escrow
              protection, real-time tracking, and delivery confirmation.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
              <Link href="/register">
                <Button size="lg" className="text-base">
                  Create Free Account
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" size="lg" className="text-base">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 bg-muted">
          <div className="max-w-7xl mx-auto px-4 lg:px-8">
            <h2 className="text-3xl font-bold text-center text-foreground mb-12">
              Why Errand Boy?
            </h2>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((feat) => (
                <div
                  key={feat.title}
                  className="flex flex-col items-center text-center p-6"
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                    <feat.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{feat.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {feat.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="max-w-3xl mx-auto px-4 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-foreground mb-4">Ready to get started?</h2>
            <p className="text-muted-foreground mb-8">
              Join thousands of Nigerians who trust Errand Boy for their daily
              errands. Whether you need something delivered or want to earn
              money running errands — we&apos;ve got you.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link href="/register?role=requester">
                <Button size="lg" variant="outline">
                  I Need Errands Done
                </Button>
              </Link>
              <Link href="/register?role=errander">
                <Button size="lg">
                  I Want to Earn
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 bg-card">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Errand Boy. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
