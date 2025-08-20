import { Loader2Icon } from "lucide-react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const baseURL = "http://localhost:3000/api/equity/annualReports/:ticker";

export function TriggerFlow({ selected }) {
  const [status, setStatus] = useState("Submit");

  async function handleSubmit() {
    const ticker = selected;

    try {
      setStatus("Fetching");
      const res = await axios.get(
        `http://localhost:3000/api/equity/annualReports/${ticker}`
      );
      setStatus("Submit");
      console.log(res.data.data[0].fileName);
    } catch (error) {
      console.log(error);
    }
  }
  let content = { status };
  if (status === "Submit") {
    content = status;
  } else {
    content = (
      <>
        <Loader2Icon className="animate-spin" />
        {status}
      </>
    );
  }
  return (
    <Button size="sm" onClick={handleSubmit}>
      {content}
    </Button>
  );
}
