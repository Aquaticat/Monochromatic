<script
  setup
  lang='ts'>
defineProps<{ date: Date; }>();
</script>

<template>
  <time :datetime='String(date)'>
    {{
      date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      })
    }}
  </time>
</template>
