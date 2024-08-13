export interface ListVote {
  number: string;
  votes: number;
}

export interface CandidateVote {
  candidate: string;
  votes: number;
  party: string;
}

export interface GroupedLists {
  [party: string]: ListVote[];
}

export interface GroupedCandidates {
  [party: string]: {
    totalVotes: number;
    candidates: CandidateVote[];
  };
}

export interface PartyData {
  totalVotes: number;
  lists?: { number: string; votes: number }[];
  candidates?: { name: string; votes: number }[];
}
