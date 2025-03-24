<script lang="ts">
    export let data: { users: any };
</script>

<div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">Notion Users</h1>
    
    {#if data.users?.results}
        <div class="grid gap-4">
            {#each data.users.results as user}
                <div class="border p-4 rounded-lg shadow">
                    <div class="flex items-center gap-4">
                        {#if user.avatar_url}
                            <img 
                                src={user.avatar_url} 
                                alt={user.name} 
                                class="w-12 h-12 rounded-full"
                            />
                        {/if}
                        <div>
                            <h2 class="font-semibold">{user.name}</h2>
                            <p class="text-gray-600">{user.email}</p>
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    {:else}
        <p class="text-gray-600">No users found</p>
    {/if}
</div>
