import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify user authentication
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role client to check admin status
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });

    if (roleError || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden - Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const { team_id, user_id, action, role = 'member' } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate role value
    if (role !== 'member' && role !== 'lead') {
      return new Response(JSON.stringify({ error: 'Role must be "member" or "lead"' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: set-role - Update role of existing team member
    if (action === 'set-role') {
      const { error: updateError } = await supabaseAdmin
        .from('team_members')
        .update({ role })
        .eq('user_id', user_id);

      if (updateError) {
        console.error('Update role error:', updateError);
        return new Response(JSON.stringify({ error: 'Failed to update role' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, action: 'role-updated', role }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'remove') {
      // Remove user from any team
      const { error: removeError } = await supabaseAdmin
        .from('team_members')
        .delete()
        .eq('user_id', user_id);

      if (removeError) {
        console.error('Remove team member error:', removeError);
        return new Response(JSON.stringify({ error: 'Failed to remove team member' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, action: 'removed' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'assign') {
      if (!team_id) {
        return new Response(JSON.stringify({ error: 'Team ID is required for assignment' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // First, remove user from any existing team
      await supabaseAdmin
        .from('team_members')
        .delete()
        .eq('user_id', user_id);

      // Then add to the new team with specified role
      const { data: membership, error: assignError } = await supabaseAdmin
        .from('team_members')
        .insert({
          team_id,
          user_id,
          role,
        })
        .select()
        .single();

      if (assignError) {
        console.error('Assign team member error:', assignError);
        return new Response(JSON.stringify({ error: 'Failed to assign team member' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, membership }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use "assign", "remove", or "set-role"' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Admin assign team member error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
