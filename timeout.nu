def main [
  myDuration: duration
  --
  ...command: string
] {
  let job_id = (job spawn { nu -c ($command | str join ' ') })
  let start = (date now)

  loop {
    if ($job_id not-in (job list | get id)) {
      break  # Job finished
    }

    if ((date now) - $start) > $myDuration {
      job kill $job_id
      print $"task killed, timeout ($myDuration)"
      exit 124
    }

    sleep 50ms  # Poll every 50ms
  }
}
