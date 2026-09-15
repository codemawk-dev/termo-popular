import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCandidateRepository } from "../src/supabase/repositories.js";

describe("createCandidateRepository", () => {
  it("lists active candidates by office from Supabase rows", async () => {
    const client = {
      from(table) {
        assert.equal(table, "candidates");
        return {
          select(columns) {
            assert.equal(columns, "*");
            return {
              eq(column, value) {
                assert.equal(column, "office");
                assert.equal(value, "prefeito");
                return {
                  order(orderColumn) {
                    assert.equal(orderColumn, "ballot_name");
                    return Promise.resolve({
                      data: [
                        {
                          id: "cand-1",
                          tse_id: "123",
                          ballot_name: "MARINA",
                          ballot_number: "45",
                          party_initials: "PA",
                          party_name: "Partido Azul",
                          office: "prefeito",
                          status: "APTO",
                          photo_url: null
                        }
                      ],
                      error: null
                    });
                  }
                };
              }
            };
          }
        };
      }
    };

    const repository = createCandidateRepository(client);

    assert.deepEqual(await repository.list({ office: "prefeito" }), [
      {
        id: "cand-1",
        tseId: "123",
        ballotName: "MARINA",
        ballotNumber: "45",
        partyInitials: "PA",
        partyName: "Partido Azul",
        office: "prefeito",
        status: "APTO",
        photoUrl: null
      }
    ]);
  });
});
