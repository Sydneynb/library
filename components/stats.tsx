"use client";

import { Card, CardContent } from "@/components/ui/card";

const data = [
  {
    name: "Total books",
    stat: "2",
  },
  {
    name: "Check In",
    stat: "1",
  },
  {
    name: "Check Out",
    stat: "1",
  }
];

export default function Stats() {
  return (
    <div className="flex items-center justify-center w-full">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 w-full">
        {data.map((item) => (
          <Card key={item.name} className="p-6 py-4 w-full shadow-none bg-accent">
            <CardContent className="p-0">
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-muted-foreground">
                  {item.name}
                </dt>
              </div>
              <dd className="text-3xl font-semibold text-foreground mt-2">
                {item.stat}
              </dd>
            </CardContent>
          </Card>
        ))}
      </dl>
    </div>
  );
}
