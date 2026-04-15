import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";
import { useToast } from "@/hooks/use-toast";

function Particles() {
  const particles = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    size: 3 + Math.random() * 5,
    duration: 8 + Math.random() * 12,
    delay: Math.random() * 10,
    opacity: 0.3 + Math.random() * 0.4,
  }));

  return (
    <>
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            opacity: p.opacity,
          }}
        />
      ))}
    </>
  );
}

function Waves() {
  return (
    <div className="wave-container">
      <div className="wave" style={{ opacity: 0.15 }}>
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none">
          <path
            d="M0,60 C360,120 720,0 1080,60 C1260,90 1440,60 1440,60 L1440,120 L0,120 Z"
            fill="hsl(189 100% 23% / 0.3)"
          />
        </svg>
      </div>
      <div className="wave" style={{ opacity: 0.1, animationDuration: "12s", animationDelay: "-3s" }}>
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none">
          <path
            d="M0,80 C240,20 480,100 720,50 C960,0 1200,80 1440,40 L1440,120 L0,120 Z"
            fill="hsl(43 73% 47% / 0.3)"
          />
        </svg>
      </div>
      <div className="wave" style={{ opacity: 0.08, animationDuration: "15s", animationDelay: "-6s" }}>
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none">
          <path
            d="M0,40 C300,100 600,20 900,70 C1100,100 1300,30 1440,60 L1440,120 L0,120 Z"
            fill="hsl(191 44% 40% / 0.4)"
          />
        </svg>
      </div>
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signIn(email, password);
      navigate("/");
    } catch (err: any) {
      toast({ title: "خطأ في تسجيل الدخول", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 animated-bg" dir="rtl">
      {/* Background Logo */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <img
          src={logo}
          alt=""
          className="absolute top-[10%] left-[10%] w-[300px] h-[300px] object-contain opacity-[0.12] animate-float-slow"
        />
        <img
          src={logo}
          alt=""
          className="absolute top-[50%] right-[5%] w-[400px] h-[400px] object-contain opacity-[0.08] animate-float-slow-reverse"
        />
        <img
          src={logo}
          alt=""
          className="absolute bottom-[5%] left-[30%] w-[250px] h-[250px] object-contain opacity-[0.1] animate-float-slow"
          style={{ animationDelay: '3s' }}
        />
        <img
          src={logo}
          alt=""
          className="absolute top-[5%] right-[30%] w-[200px] h-[200px] object-contain opacity-[0.06] animate-float-slow-reverse"
          style={{ animationDelay: '5s' }}
        />
      </div>

      {/* Blobs */}
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />

      {/* Particles */}
      <Particles />

      {/* Waves */}
      <Waves />

      {/* Login Card */}
      <Card className="w-full max-w-md shadow-2xl border-0 glass-card shimmer-border z-10 animate-scale-in">
        <CardHeader className="text-center pb-2">
          <div className="relative mx-auto mb-4">
            <div
              className="absolute inset-0 rounded-full blur-xl"
              style={{ background: "hsl(43 73% 47% / 0.3)" }}
            />
            <img src={logo} alt="جهار" className="relative mx-auto w-24 h-24 object-contain drop-shadow-lg" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-primary-foreground">
            منصة تعلم مركز تدريب<br />الهيئة العامة للاعتماد والرقابة الصحية
          </h1>
          <p className="text-primary-foreground/60 text-sm mt-1">سجّل دخولك للمتابعة</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-primary-foreground/80">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                dir="ltr"
                required
                className="bg-white/10 border-white/20 text-primary-foreground placeholder:text-primary-foreground/30 focus:border-accent focus:ring-accent/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-primary-foreground/80">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                required
                className="bg-white/10 border-white/20 text-primary-foreground placeholder:text-primary-foreground/30 focus:border-accent focus:ring-accent/30"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold shadow-lg transition-all duration-300 hover:shadow-accent/30 hover:shadow-xl hover:-translate-y-0.5"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              تسجيل الدخول
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
