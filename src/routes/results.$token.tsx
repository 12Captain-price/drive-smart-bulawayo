import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, Award } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/site/blocks";
import { useAssignments, useSettings, useStudents, useSubmissions, useTests, waLink } from "@/lib/data";

export const Route = createFileRoute("/results/$token")({
  component: Results,
  head: () => ({
    meta: [
      { title: "Your Test Result — Auto Driving School" },
      { name: "description", content: "See your Auto Driving School test result at your private results link." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Your Test Result — Auto Driving School" },
      { property: "og:description", content: "Private test result page for Auto Driving School learners." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Results() {
  const { token } = Route.useParams();
  const { items: assignments } = useAssignments();
  const { items: submissions } = useSubmissions();
  const { items: tests } = useTests();
  const { items: students } = useStudents();
  const { settings } = useSettings();

  const assignment = assignments.find((a) => a.resultsToken === token);
  const submission = submissions.find((s) => s.assignmentId === assignment?.id);
  const test = tests.find((t) => t.id === assignment?.testId);
  const student = students.find((s) => s.id === assignment?.studentId);

  if (!assignment || !submission)
    return (
      <Section className="max-w-md">
        <Card className="shadow-lg">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <AlertCircle className="text-accent size-12" />
            <h1 className="text-xl font-semibold">Nothing to show here yet</h1>
            <p className="text-muted-foreground text-sm">
              Your result isn't ready. The school will send you the link as soon as it is.
            </p>
          </CardContent>
        </Card>
      </Section>
    );

  const score =
    submission.mark ??
    (submission.autoTotal !== undefined ? `${submission.autoScore}/${submission.autoTotal}` : "Being marked");

  return (
    <Section className="max-w-md">
      <Card className="shadow-lg">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <Award className="text-primary size-14" />
          <p className="label-mono text-accent">{test?.title ?? "Your test"}</p>
          <h1 className="text-2xl font-bold">{student?.name ?? "Your result"}</h1>
          <p className="text-primary font-mono text-4xl font-bold">{score}</p>
          {submission.feedback && (
            <p className="bg-secondary/60 text-foreground rounded-lg border p-4 text-sm">{submission.feedback}</p>
          )}
          <p className="text-muted-foreground text-sm">
            Written on {new Date(submission.submittedAt).toLocaleDateString()}
          </p>
          <Button asChild size="lg" className="bg-success text-success-foreground hover:bg-success/90">
            <a
              href={waLink(settings.whatsapp, `Hi Auto Driving School, I have a question about my ${test?.title ?? "test"} result.`)}
              target="_blank"
              rel="noreferrer"
            >
              Ask us a question
            </a>
          </Button>
        </CardContent>
      </Card>
    </Section>
  );
}
