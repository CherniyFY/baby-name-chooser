export type Person = "first" | "second";
export type Rating = "neutral" | "love" | "like" | "maybe" | "dismissed" | "veto";
export type Pair = { a: string; b: string };
export type Choice = "a" | "b" | "tie";
export type League = { id: string; title: string; nameIds: string[]; createdAt: string };
export type Vote = Pair & { leagueId: string; person: Person; choice: Choice; updatedAt: string };
export type SharedState = {
  ratings: Record<string, Record<Person, Rating>>;
  notes: Record<string, string>;
  leagues: League[];
  votes: Vote[];
  updatedAt: string;
};
