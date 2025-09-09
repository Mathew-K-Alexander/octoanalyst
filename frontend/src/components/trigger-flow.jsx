import { Loader2Icon } from "lucide-react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";

const baseURL = "http://localhost:3000";

export function TriggerFlow({ selected, setMapcontent }) {
  const [status, setStatus] = useState("idle");
  const [label, setLabel] = useState("Submit");

  const esRef = useRef(null);

  function closeStream() {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }

  async function handleSubmit() {
    if (!selected || status === "running") return;

    try {
      setStatus("running");
      setLabel("Starting…");

      // 1) Start the job
      const { data } = await axios.post(
        `${baseURL}/api/equity/annualReports/${selected}/start`
      );
      const { jobId } = data;
      setLabel("Fetching PDF URL…");

      // 2) Open the SSE stream
      const es = new EventSource(`${baseURL}/api/jobs/${jobId}/stream`);
      esRef.current = es;

      es.addEventListener("status", (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          const msg = payload?.status || payload?.message || "Working…";
          setLabel(msg);
        } catch {
          setLabel("Working…");
        }
      });

      es.addEventListener("done", () => {
        setStatus("creating map");
        setLabel("creating map");

        async function load() {
          try {
            const res = await fetch(`${baseURL}/api/summary/${selected}`);
            if (!res.ok)
              throw new Error(`Failed to fetch summary for ${ticker}`);
            const json = await res.json();
            setMapcontent(json);
          } catch (e) {
            console.log(e);
          }
        }
        load();
        closeStream();
        setLabel("Done");
      });

      es.onerror = () => {
        if (status === "running") {
          setStatus("error");
          setLabel("Error");
          closeStream();
        }
      };
    } catch (e) {
      setStatus("error");
      setLabel(e?.message || "Error");
    }
  }

  const isRunning = status === "running";

  return (
    <Button size="sm" onClick={handleSubmit} disabled={isRunning}>
      {isRunning ? (
        <>
          <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
          {label}
        </>
      ) : (
        label
      )}
    </Button>
  );
}
